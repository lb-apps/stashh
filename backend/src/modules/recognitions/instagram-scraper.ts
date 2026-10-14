import { igdl } from "btch-downloader";
import type { Logger } from "../../lib/logger.js";
import type { SourceContent } from "../../types/schemas.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractShortcode(url: string): string {
  const path = new URL(url).pathname.replace(/\/$/, "");
  const segments = path.split("/");
  for (let i = segments.length - 1; i >= 0; i--) {
    if (["p", "reel", "reels", "tv"].includes(segments[i]!) && segments[i + 1]) {
      return segments[i + 1]!;
    }
  }
  throw new Error(`Cannot extract shortcode from URL: ${url}`);
}

function detectSourceType(url: string): "reel" | "post" {
  return /\/reels?\//i.test(url) ? "reel" : "post";
}

function decodeHtmlEntitiesOnce(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

/**
 * Instagram double-escapes entities in some markup variants (`&amp;amp;`), which
 * left query strings with literal `amp;` param prefixes and broke CDN URL signatures.
 * Decode repeatedly until the string stops changing.
 */
function decodeHtmlEntities(str: string): string {
  let current = str;
  for (let pass = 0; pass < 3; pass++) {
    const next = decodeHtmlEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

// ─── Instagram scraper ──────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

function extractVideoUrl(html: string): string | null {
  const p1 = html.match(
    /"video_versions"\s*:\s*\[\s*\{\s*"width"\s*:\s*\d+\s*,\s*"height"\s*:\s*\d+\s*,\s*"url"\s*:\s*"([^"]+)"/,
  );
  if (p1?.[1]) return JSON.parse(`"${p1[1]}"`);

  const p2 = html.match(/"video_url"\s*:\s*"([^"]+\.mp4[^"]*)"/);
  if (p2?.[1]) return JSON.parse(`"${p2[1]}"`);

  const p3 = html.match(/"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/);
  if (p3?.[1]) return JSON.parse(`"${p3[1]}"`);

  const p4 = html.match(
    /<meta\s+property="og:video(?::(?:url|secure_url))?"\s+content="([^"]+)"/,
  );
  if (p4?.[1]) return decodeHtmlEntities(p4[1]!);

  const p5 = html.match(/https:\\\/\\\/[^"']+\.mp4[^"'\\]*/);
  if (p5?.[0]) return decodeHtmlEntities(p5[0].replace(/\\\//g, "/"));

  return null;
}

/**
 * Instagram's anonymous markup sometimes yields an unsigned CDN URL (no `oh`/`oe`
 * params), which fbcdn rejects with `403 Bad URL hash`. A ranged probe is far cheaper
 * than discovering that after the full download in the analyzer.
 */
async function isVideoUrlPlayable(videoUrl: string, log: Logger): Promise<boolean> {
  try {
    const res = await fetch(videoUrl, {
      headers: { ...BROWSER_HEADERS, Accept: "*/*", Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 206) {
      log.warn({ status: res.status }, "scraped video url not playable");
      return false;
    }
    return true;
  } catch (probeError) {
    log.warn(
      { err: probeError instanceof Error ? probeError.message : String(probeError) },
      "video url probe failed",
    );
    return false;
  }
}

/** Fallback resolver for when Instagram's HTML carries no usable video URL. */
async function resolveVideoUrlViaDownloader(postUrl: string, log: Logger): Promise<string | null> {
  try {
    const result = await igdl(postUrl);
    const items = Array.isArray(result) ? result : (result?.result ?? []);
    for (const item of items) {
      const candidate = typeof item === "string" ? item : item?.url;
      if (typeof candidate === "string" && candidate.length > 0) {
        log.info({ host: new URL(candidate).host }, "video url resolved via downloader");
        return candidate;
      }
    }
    log.warn("downloader returned no video url");
    return null;
  } catch (downloaderError) {
    log.warn(
      { err: downloaderError instanceof Error ? downloaderError.message : String(downloaderError) },
      "downloader failed",
    );
    return null;
  }
}

function extractCaption(html: string): string | null {
  const match = html.match(/<meta property="og:description" content="([^"]*)"/);
  if (!match) return null;

  const raw = decodeHtmlEntities(match[1]!);
  const colonIdx = raw.indexOf(": ");
  const caption =
    colonIdx !== -1
      ? raw.slice(colonIdx + 2).replace(/^"/, "").replace(/"$/, "")
      : raw;

  return caption.trim() || null;
}

async function fetchInstagramHtml(shortcode: string, log: Logger): Promise<string> {
  const urls = [
    `https://www.instagram.com/reel/${shortcode}/`,
    `https://www.instagram.com/p/${shortcode}/`,
  ];

  let lastStatus = 0;
  let gotLoginPage = false;
  let lastFetchError: string | null = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      lastStatus = res.status;
      if (!res.ok) {
        log.warn({ url, status: res.status }, "HTTP error");
        continue;
      }
      const html = await res.text();

      if (html.includes("loginForm") || html.includes("/accounts/login/")) {
        gotLoginPage = true;
      }

      if (html.includes("video_versions") || html.includes("og:video") || html.includes("video_url")) {
        return html;
      }
      if (html.includes("og:description")) return html;
    } catch (fetchError) {
      lastFetchError = fetchError instanceof Error ? fetchError.message : String(fetchError);
      log.warn({ url, err: lastFetchError }, "fetch error");
      continue;
    }
  }

  if (gotLoginPage) {
    throw new Error(
      `Instagram returned a login page for shortcode "${shortcode}". The post may be private or Instagram is requiring authentication for server-side requests.`,
    );
  }

  const suffix = lastFetchError ? ` Last network error: ${lastFetchError}` : "";
  throw new Error(
    `Could not fetch Instagram page for shortcode "${shortcode}" (last HTTP status: ${lastStatus}).${suffix} The post may have been deleted or the URL is invalid.`,
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchInstagramContent(
  url: string,
  log: Logger,
): Promise<SourceContent> {
  const shortcode = extractShortcode(url);
  const sourceType = detectSourceType(url);

  const html = await fetchInstagramHtml(shortcode, log);

  const caption = extractCaption(html);
  const scrapedVideoUrl = extractVideoUrl(html);

  let videoUrl: string | null = null;
  if (scrapedVideoUrl && (await isVideoUrlPlayable(scrapedVideoUrl, log))) {
    videoUrl = scrapedVideoUrl;
  } else {
    // Anonymous Instagram markup no longer reliably embeds a signed video URL.
    const canonicalUrl = `https://www.instagram.com/${sourceType === "reel" ? "reel" : "p"}/${shortcode}/`;
    videoUrl = await resolveVideoUrlViaDownloader(canonicalUrl, log);
  }

  if (!videoUrl) {
    throw new Error(
      `Could not extract video URL from Instagram page (shortcode: ${shortcode}). The post may be private, image-only, or Instagram changed their HTML structure.`,
    );
  }

  return {
    video_url: videoUrl,
    caption,
    source_type: sourceType,
    platform: "instagram",
  };
}
