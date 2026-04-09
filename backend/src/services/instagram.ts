import type { InstagramContent } from "../types/schemas.js";

const DEBUG_TRACE = process.env["RECOGNITIONS_DEBUG_TRACE"] === "true";

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractShortcode(url: string): string {
  const path = new URL(url).pathname.replace(/\/$/, "");
  const segments = path.split("/");
  for (let i = segments.length - 1; i >= 0; i--) {
    if (["p", "reel", "tv"].includes(segments[i]!) && segments[i + 1]) {
      return segments[i + 1]!;
    }
  }
  throw new Error(`Cannot extract shortcode from URL: ${url}`);
}

function detectSourceType(url: string): "reel" | "post" | "story" {
  if (/\/reel\//i.test(url)) return "reel";
  if (/\/stories\//i.test(url)) return "story";
  return "post";
}

function decodeHtmlEntities(str: string): string {
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
  // Pattern 1: video_versions array (most common in embedded JSON)
  const p1 = html.match(
    /"video_versions"\s*:\s*\[\s*\{\s*"width"\s*:\s*\d+\s*,\s*"height"\s*:\s*\d+\s*,\s*"url"\s*:\s*"([^"]+)"/,
  );
  if (p1?.[1]) return JSON.parse(`"${p1[1]}"`);

  // Pattern 2: video_url field
  const p2 = html.match(/"video_url"\s*:\s*"([^"]+\.mp4[^"]*)"/);
  if (p2?.[1]) return JSON.parse(`"${p2[1]}"`);

  // Pattern 3: contentUrl in schema.org JSON-LD
  const p3 = html.match(/"contentUrl"\s*:\s*"([^"]+\.mp4[^"]*)"/);
  if (p3?.[1]) return JSON.parse(`"${p3[1]}"`);

  // Pattern 4: og:video meta tag
  const p4 = html.match(
    /<meta\s+property="og:video(?::(?:url|secure_url))?"\s+content="([^"]+)"/,
  );
  if (p4?.[1]) return decodeHtmlEntities(p4[1]!);

  // Pattern 5: bare mp4 URL in JSON blob
  const p5 = html.match(/https:\\\/\\\/[^"']+\.mp4[^"'\\]*/);
  if (p5?.[0]) return p5[0].replace(/\\\//g, "/");

  return null;
}

function extractCaption(html: string): string | null {
  const match = html.match(/<meta property="og:description" content="([^"]*)"/);
  if (!match) return null;

  const raw = decodeHtmlEntities(match[1]!);
  // Format: "X likes, Y comments - username on Month DD, YYYY: "caption""
  const colonIdx = raw.indexOf(": ");
  const caption =
    colonIdx !== -1
      ? raw.slice(colonIdx + 2).replace(/^"/, "").replace(/"$/, "")
      : raw;

  return caption.trim() || null;
}

async function fetchInstagramHtml(shortcode: string): Promise<string> {
  const urls = [
    `https://www.instagram.com/reel/${shortcode}/`,
    `https://www.instagram.com/p/${shortcode}/`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();
      // Sanity check — if we got redirected to login we won't find video data
      if (html.includes("video_versions") || html.includes("og:video") || html.includes("video_url")) {
        return html;
      }
      // Still return even if no video patterns — caption might be there
      if (html.includes("og:description")) return html;
    } catch {
      continue;
    }
  }

  throw new Error(`Could not fetch Instagram page for shortcode: ${shortcode}`);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function fetchInstagramContent(
  url: string,
): Promise<InstagramContent> {
  const t0 = Date.now();
  const shortcode = extractShortcode(url);

  const html = await fetchInstagramHtml(shortcode);
  console.log(`[instagram] Fetched HTML in ${Date.now() - t0}ms`);

  const videoUrl = extractVideoUrl(html);
  const caption = extractCaption(html);

  console.log(`[instagram] Video URL found: ${videoUrl ? "yes" : "NO"}`);
  console.log(`[instagram] Caption: ${caption ? caption.slice(0, 80) : "none"}`);
  if (DEBUG_TRACE) {
    console.log("[recognitions:trace] instagram.caption.full", caption ?? "<null>");
    console.log("[recognitions:trace] instagram.caption.has_at", Boolean(caption?.includes("@")));
    console.log("[recognitions:trace] instagram.shortcode", shortcode);
  }

  if (!videoUrl) {
    throw new Error(
      "Could not extract video URL from Instagram page. The post may be private or Instagram changed their HTML structure.",
    );
  }

  return {
    videoUrl,
    caption,
    sourceType: detectSourceType(url),
  };
}
