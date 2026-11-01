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

async function askDownloader(postUrl: string): Promise<DownloaderItem[]> {
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
    // The library returns its failures (`status: false`) instead of throwing them. Throttled, the
    // service answers in under a second with `status: true` and a page of blank `{ url: "" }` items.
    if (raw.length > 0) throw new Error(`throttled: ${raw.length} blank items`);
    const status = Array.isArray(result) ? null : (result as { status?: unknown; message?: unknown } | undefined);
    throw new Error(`no media (status ${String(status?.status ?? null)}): ${String(status?.message ?? "no message")}`);
  }
  return slides;
}

/**
 * Every media item of a post, through the downloader service: the only route that lists
 * a carousel's slides, and the fallback when Instagram's HTML carries no usable video.
 * The service answers unevenly from one call to the next, so an empty answer is asked once more.
 * With no slides, `failure` is the service's last answer, kept so the task's error says why.
 */
async function resolveMediaViaDownloader(postUrl: string, log: Logger): Promise<{ slides: DownloaderItem[]; failure: string | null }> {
  let failure: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const slides = await askDownloader(postUrl);
      log.info({ host: new URL(slides[0]!.url).host, slides: slides.length, attempt }, "media resolved via downloader");
      return { slides, failure: null };
    } catch (downloaderError) {
      failure = downloaderError instanceof Error ? downloaderError.message : String(downloaderError);
      log.warn({ err: failure, attempt }, "downloader failed");
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return { slides: [], failure };
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

  // Trimmed first: the attribute often ends in whitespace, which kept `".` on every caption.
  const raw = decodeHtmlEntities(match[1]!).trim();
  const colonIdx = raw.indexOf(": ");
  const caption =
    colonIdx !== -1
      ? raw.slice(colonIdx + 2).replace(/^"/, "").replace(/"\.?$/, "")
      : raw;

  return caption.trim() || null;
}

const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

/**
 * The post's author: the username in a `/<user>/reel/<code>` link, else the one in the
 * page's og:description (`<likes> - <user> on <date>: …`, served in English). Null when
 * neither names one.
 */
export function extractAuthor(url: string, html: string | null): string | null {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const head = segments[0];
  if (head && segments.length >= 3 && ["p", "reel", "reels", "tv"].includes(segments[1]!) && USERNAME.test(head)) return head;

  const description = html?.match(/<meta property="og:description" content="([^"]*)"/)?.[1];
  const author = description ? decodeHtmlEntities(description).match(/ - ([A-Za-z0-9._]{1,30}) on [^:]+: /)?.[1] : undefined;
  return author ?? null;
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

/**
 * A post's media and caption. `channelCaption` is the caption a DM channel received with
 * the post; it wins over the page's. With no media but a caption, the content comes back
 * with no media (`fetch_method: "caption"`) so the caption can be read alone.
 */
export async function fetchInstagramContent(
  url: string,
  log: Logger,
  channelCaption: string | null = null,
): Promise<SourceContent> {
  const shortcode = extractShortcode(url);
  const sourceType = detectSourceType(url);

  // Instagram often answers a server with an empty app shell (200, no og tags). The page only
  // adds the caption and a signed video URL; the downloader does not need it, so it still runs.
  let html: string | null = null;
  let pageError: unknown = null;
  try {
    html = await fetchInstagramHtml(shortcode, log);
  } catch (error) {
    pageError = error;
    log.warn({ err: error instanceof Error ? error.message : String(error) }, "page unreadable; asking the downloader");
  }

  const caption = channelCaption ?? (html ? extractCaption(html) : null);
  const authorUsername = extractAuthor(url, html);
  const scrapedVideoUrl = html ? extractVideoUrl(html) : null;
  const canonicalUrl = `https://www.instagram.com/${sourceType === "reel" ? "reel" : "p"}/${shortcode}/`;

  let thumbnailUrl = html ? extractThumbnail(html) : null;
  let media: SourceMediaItem[] = [];
  let fetchMethod: "scrape" | "downloader" = "scrape";

  // A Reel is one video, and the page sometimes still carries a signed URL for it. A post
  // may be a carousel, whose slides only the downloader lists, so it goes there first.
  const pageVideo = async (): Promise<SourceMediaItem[]> =>
    scrapedVideoUrl && (await isVideoUrlPlayable(scrapedVideoUrl, log)) ? [{ url: scrapedVideoUrl }] : [];
  let downloaderFailure: string | null = null;
  const downloaded = async (): Promise<SourceMediaItem[]> => {
    const { slides, failure } = await resolveMediaViaDownloader(canonicalUrl, log);
    downloaderFailure = failure;
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
    const downloader = downloaderFailure ? ` Downloader: ${downloaderFailure}` : "";
    const mediaError = pageError
      ? `${pageError instanceof Error ? pageError.message : String(pageError)}${downloader}`
      : `Could not extract media from Instagram page (shortcode: ${shortcode}). The post may be private, deleted, or Instagram changed their HTML structure.${downloader}`;
    if (!caption) throw new Error(mediaError);
    log.warn({ err: mediaError }, "no media; reading the caption alone");
    return {
      media: [],
      media_error: mediaError,
      thumbnail_url: thumbnailUrl,
      fetch_method: "caption",
      caption,
      source_type: sourceType,
      platform: "instagram",
      author_username: authorUsername,
    };
  }

  return {
    media,
    thumbnail_url: thumbnailUrl,
    fetch_method: fetchMethod,
    caption,
    source_type: sourceType,
    platform: "instagram",
    author_username: authorUsername,
  };
}
