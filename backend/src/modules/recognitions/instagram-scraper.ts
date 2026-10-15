import { igdl } from "btch-downloader";
import { config } from "../../config.js";
import type { Logger } from "../../lib/logger.js";
import type { SourceContent, SourceMediaItem } from "../../types/schemas.js";

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

/**
 * A numeric entity as text. Emoji sit above U+FFFF (`&#x1F4CD;`), so this must be
 * fromCodePoint — fromCharCode keeps only the low 16 bits and turns 📍 into U+F4CD,
 * a private-use glyph. Out-of-range numbers stay as written.
 */
function codePoint(value: number, entity: string): string {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
}

function decodeHtmlEntitiesOnce(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/gi, (entity, h: string) => codePoint(parseInt(h, 16), entity))
    .replace(/&#(\d+);/g, (entity, d: string) => codePoint(parseInt(d, 10), entity));
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

export interface DownloaderItem {
  url: string;
  thumbnail: string | null;
}

/**
 * What one downloader link points at. The links are proxied, and the real CDN path sits
 * in the token's payload; a carousel comes back with every slide listed several times
 * (one link per rendition), so this is what tells the renditions of one slide apart.
 */
function mediaIdentity(item: DownloaderItem): string {
  try {
    const token = new URL(item.url).searchParams.get("token");
    const payload = token?.split(".")[1];
    if (payload) {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { url?: unknown };
      if (typeof decoded.url === "string") return new URL(decoded.url).pathname;
    }
  } catch {
    // Not a token link; the thumbnail or the link itself identifies the slide.
  }
  return item.thumbnail ?? item.url;
}

/** One link per slide, in post order. */
export function dedupeDownloaderItems(items: DownloaderItem[]): DownloaderItem[] {
  const seen = new Set<string>();
  const slides: DownloaderItem[] = [];
  for (const item of items) {
    const identity = mediaIdentity(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    slides.push(item);
  }
  return slides;
}

const DOWNLOADER_LINK_KEYS = ["url", "download_url", "downloadUrl", "src", "link", "video", "image", "media"];
const DOWNLOADER_THUMBNAIL_KEYS = ["thumbnail", "thumb", "cover", "poster"];

/** The first http link under any of the keys, as a string or inside an array; the service's field names drift. */
function firstLink(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    const candidates = Array.isArray(value) ? value : [value];
    const link = candidates.find((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
    if (link) return link;
  }
  return null;
}

async function askDownloader(postUrl: string, log: Logger): Promise<DownloaderItem[]> {
  const result = await igdl(postUrl);
  const raw: unknown[] = Array.isArray(result) ? result : (result?.result ?? []);
  const items: DownloaderItem[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      if (/^https?:\/\//.test(item)) items.push({ url: item, thumbnail: null });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = firstLink(record, DOWNLOADER_LINK_KEYS);
    if (url) items.push({ url, thumbnail: firstLink(record, DOWNLOADER_THUMBNAIL_KEYS) });
  }
  const slides = dedupeDownloaderItems(items);
  if (slides.length === 0) {
    const status = Array.isArray(result) ? null : (result as { status?: unknown; message?: unknown } | undefined);
    log.warn({ status: status?.status ?? null, message: status?.message ?? null, items: raw.length }, "downloader returned no media");
  }
  return slides;
}

/**
 * Every media item of a post, through the downloader service: the only route that lists
 * a carousel's slides, and the fallback when Instagram's HTML carries no usable video.
 * The service answers unevenly from one call to the next, so an empty answer is asked once more.
 */
async function resolveMediaViaDownloader(postUrl: string, log: Logger): Promise<DownloaderItem[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const slides = await askDownloader(postUrl, log);
      if (slides.length > 0) {
        log.info({ host: new URL(slides[0]!.url).host, slides: slides.length, attempt }, "media resolved via downloader");
        return slides;
      }
    } catch (downloaderError) {
      log.warn(
        { err: downloaderError instanceof Error ? downloaderError.message : String(downloaderError), attempt },
        "downloader failed",
      );
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return [];
}

/** The post's cover image (`og:image`), entity-decoded; null when the page has none. */
export function extractThumbnail(html: string): string | null {
  const match = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  return match ? decodeHtmlEntities(match[1]!) : null;
}

/** The post's own text from og:description: `<likes> - <user> on <date>: "<caption>".` */
export function extractCaption(html: string): string | null {
  const match = html.match(/<meta property="og:description" content="([^"]*)"/);
  if (!match) return null;

  const raw = decodeHtmlEntities(match[1]!);
  const colonIdx = raw.indexOf(": ");
  const caption =
    colonIdx !== -1
      ? raw.slice(colonIdx + 2).replace(/^"/, "").replace(/"\.?$/, "")
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
  const canonicalUrl = `https://www.instagram.com/${sourceType === "reel" ? "reel" : "p"}/${shortcode}/`;

  let thumbnailUrl = extractThumbnail(html);
  let media: SourceMediaItem[] = [];
  let fetchMethod: "scrape" | "downloader" = "scrape";

  // A Reel is one video, and the page sometimes still carries a signed URL for it. A post
  // may be a carousel, whose slides only the downloader lists, so it goes there first.
  const pageVideo = async (): Promise<SourceMediaItem[]> =>
    scrapedVideoUrl && (await isVideoUrlPlayable(scrapedVideoUrl, log)) ? [{ url: scrapedVideoUrl }] : [];
  const downloaded = async (): Promise<SourceMediaItem[]> => {
    const slides = await resolveMediaViaDownloader(canonicalUrl, log);
    if (slides.length === 0) return [];
    if (slides.length > config.RECOGNITIONS_MAX_MEDIA) {
      log.warn({ slides: slides.length, kept: config.RECOGNITIONS_MAX_MEDIA }, "carousel longer than the slide cap; trailing slides dropped");
    }
    thumbnailUrl ??= slides[0]!.thumbnail;
    fetchMethod = "downloader";
    return slides.slice(0, config.RECOGNITIONS_MAX_MEDIA).map((slide) => ({ url: slide.url }));
  };

  if (sourceType === "reel") {
    media = await pageVideo();
    if (media.length === 0) media = await downloaded();
  } else {
    media = await downloaded();
    if (media.length === 0) media = await pageVideo();
  }

  if (media.length === 0) {
    throw new Error(
      `Could not extract media from Instagram page (shortcode: ${shortcode}). The post may be private, deleted, or Instagram changed their HTML structure.`,
    );
  }

  return {
    media,
    thumbnail_url: thumbnailUrl,
    fetch_method: fetchMethod,
    caption,
    source_type: sourceType,
    platform: "instagram",
  };
}
