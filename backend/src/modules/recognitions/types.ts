import { z } from "zod";
import type { Database } from "../../types/database.js";

export type RecognitionTaskRow = Database["public"]["Tables"]["recognition_tasks"]["Row"];
export type RecognitionTaskInsert = Database["public"]["Tables"]["recognition_tasks"]["Insert"];
export type RecognitionResultRow = Database["public"]["Tables"]["recognition_results"]["Row"];

export interface RecognitionTaskOptions {
  bypass_cache?: boolean;
}

/**
 * Links the scrapers can actually read. Instagram: a post, reel or IGTV permalink,
 * optionally under a username (`/<user>/reel/<code>`). Story links are rejected up
 * front — stories are login-gated and expire, so they cannot be fetched by URL; they
 * arrive through a messaging channel as media instead.
 */
const INSTAGRAM_PERMALINK = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reels?|tv)\/[A-Za-z0-9_-]+/i;
const TIKTOK_URL = /^https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\//i;

export function isSupportedSourceUrl(url: string): boolean {
  return INSTAGRAM_PERMALINK.test(url) || TIKTOK_URL.test(url);
}

export const createRecognitionRequestSchema = z.object({
  source_url: z
    .string()
    .url()
    .refine(isSupportedSourceUrl, "Must be an Instagram post, Reel or IGTV link, or a TikTok video link"),
});

/**
 * What a recognition reads. A URL is scraped; shared media arrives with its content
 * because the channel that received it holds the only copy (an Instagram post or story
 * shared in a DM has no permalink, just a signed CDN link and, for a post, the caption).
 */
export type SharedMediaFormat = "post" | "story";

export type RecognitionSource =
  | { kind: "url"; url: string }
  | { kind: "shared_media"; provider: "instagram"; format: SharedMediaFormat; mediaId: string; mediaUrl: string; caption: string | null };

/** Hosts Instagram's messaging CDN serves shared media from. */
const SHARED_MEDIA_HOST = /(?:^|\.)(?:fbsbx\.com|cdninstagram\.com|fbcdn\.net)$/i;

function isSharedMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && SHARED_MEDIA_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

const sharedMediaSchema = z.object({
  provider: z.literal("instagram"),
  /** A feed post (default) or a story; a story's media is read but never stored. */
  format: z.enum(["post", "story"]).default("post"),
  media_id: z.string().regex(/^\d{1,32}$/, "media_id must be numeric"),
  media_url: z.string().url().refine(isSharedMediaUrl, "media_url must be an https Instagram CDN link"),
  caption: z.string().max(10_000).nullable().optional(),
});

/** Internal API: a URL like the public API, or media a channel received. */
export const createInternalRecognitionRequestSchema = z.union([
  createRecognitionRequestSchema,
  z.object({ shared_media: sharedMediaSchema }),
]);

export function toRecognitionSource(body: z.infer<typeof createInternalRecognitionRequestSchema>): RecognitionSource {
  if ("source_url" in body) return { kind: "url", url: body.source_url };
  const media = body.shared_media;
  return { kind: "shared_media", provider: media.provider, format: media.format, mediaId: media.media_id, mediaUrl: media.media_url, caption: media.caption ?? null };
}

export const recognitionIdentifierSchema = z.object({
  id: z.string().uuid("Recognition id must be a UUID"),
});

/** Query for GET /recognitions/result?id= */
export const recognitionResultQuerySchema = z.object({
  id: z.string().uuid("Result id must be a UUID"),
});
