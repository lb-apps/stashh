import type { Logger } from "../../lib/logger.js";
import type { SourceContent, SourcePlatform } from "../../types/schemas.js";
import { fetchInstagramContent } from "./instagram-scraper.js";
import { fetchTikTokContent, isTikTokUrl } from "./tiktok-scraper.js";

/**
 * Routes a source URL to the right scraper.
 *
 * The worker should not know which platform a task came from; it asks for content
 * and gets a normalised `SourceContent` back. Adding a platform means adding a
 * scraper and a branch here, nothing else.
 */

export function detectPlatform(url: string): SourcePlatform | null {
  if (isTikTokUrl(url)) return "tiktok";
  try {
    return /(?:^|\.)instagram\.com$/i.test(new URL(url).host) ? "instagram" : null;
  } catch {
    return null;
  }
}

export async function fetchSourceContent(
  url: string,
  log: Logger,
): Promise<SourceContent> {
  const platform = detectPlatform(url);

  if (platform === "tiktok") {
    return fetchTikTokContent(url, log);
  }
  if (platform === "instagram") {
    return fetchInstagramContent(url, log);
  }

  throw new Error(
    `Unsupported source URL: ${url}. Only Instagram and TikTok links are supported.`,
  );
}
