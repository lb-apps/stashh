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

export const recognitionIdentifierSchema = z.object({
  id: z.string().uuid("Recognition id must be a UUID"),
});

/** Query for GET /recognitions/result?id= */
export const recognitionResultQuerySchema = z.object({
  id: z.string().uuid("Result id must be a UUID"),
});
