import { ttdl } from "btch-downloader";
import type { Logger } from "../../lib/logger.js";
import type { SourceContent } from "../../types/schemas.js";

/**
 * TikTok scraper.
 *
 * TikTok gives anonymous scrapers even less than Instagram does: the public HTML
 * carries no playable video URL at all. So unlike the Instagram path there is no
 * "scrape first, fall back second" — the downloader is the only route.
 *
 * `ttdl` returns the post title, which is TikTok's caption, so the analyzer gets
 * the same two inputs it gets for Instagram (video plus caption).
 */

/** Matches the canonical form plus the vm./vt./t/ short links that shares produce. */
const TIKTOK_URL = /(?:^|\.)tiktok\.com\//i;

export function isTikTokUrl(url: string): boolean {
  try {
    return TIKTOK_URL.test(new URL(url).host + "/");
  } catch {
    return false;
  }
}

export async function fetchTikTokContent(
  url: string,
  log: Logger,
): Promise<SourceContent> {
  let result;
  try {
    result = await ttdl(url);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`TikTok downloader failed: ${detail}`);
  }

  const videoUrl = (result?.video ?? []).find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.length > 0,
  );

  if (!videoUrl) {
    // Empty arrays with status:true is what a deleted or region-locked post looks like.
    throw new Error(
      `Could not extract video URL from TikTok post. It may be private, deleted, region-locked, or a photo carousel.`,
    );
  }

  const caption = result.title?.trim() || null;
  log.info(
    { host: new URL(videoUrl).host, captionLength: caption?.length ?? 0 },
    "tiktok content resolved",
  );

  return {
    media_url: videoUrl,
    caption,
    source_type: "tiktok",
    platform: "tiktok",
  };
}
