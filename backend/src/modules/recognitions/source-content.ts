import { z } from "zod";
import type { Logger } from "../../lib/logger.js";
import type { SourceContent, SourcePlatform } from "../../types/schemas.js";
import { fetchInstagramContent } from "./instagram-scraper.js";
import { fetchTikTokContent, isTikTokUrl } from "./tiktok-scraper.js";
import type { RecognitionTaskRow } from "./types.js";

/**
 * Turns a task into the content the model reads.
 *
 * The worker should not know where a task came from; it asks for content and gets a
 * normalised `SourceContent` back. Content a channel supplied (`source_media`) is used
 * as is; a URL is routed to its platform's scraper. Adding a platform means adding a
 * scraper and a branch here, nothing else.
 */

const suppliedContentSchema = z.object({
  media_url: z.string().url(),
  caption: z.string().nullable(),
  platform: z.enum(["instagram", "tiktok"]),
  source_type: z.enum(["reel", "post", "story", "tiktok"]),
});

export function detectPlatform(url: string): SourcePlatform | null {
  if (isTikTokUrl(url)) return "tiktok";
  try {
    return /(?:^|\.)instagram\.com$/i.test(new URL(url).host) ? "instagram" : null;
  } catch {
    return null;
  }
}

export async function fetchSourceContent(
  task: Pick<RecognitionTaskRow, "source_url" | "source_media">,
  log: Logger,
): Promise<SourceContent> {
  if (task.source_media !== null) {
    const supplied = suppliedContentSchema.safeParse(task.source_media);
    if (!supplied.success) throw new Error(`Task source_media is malformed: ${supplied.error.message}`);
    // The shared media is its own cover; the worker keeps it only if it is an image.
    return { ...supplied.data, thumbnail_url: supplied.data.media_url, fetch_method: "supplied" };
  }

  const url = task.source_url;
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
