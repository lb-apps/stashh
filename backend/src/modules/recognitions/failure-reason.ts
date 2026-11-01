import type { RecognitionTaskRow } from "./types.js";

/**
 * Why a recognition failed, in terms a person can act on; the channel words its reply from it.
 * `error_message` stays the precise reason for the ops dashboard.
 *
 * - `private`: Instagram showed its login page, so the post is behind a private account.
 * - `temporarily_unavailable`: the post's media could not be fetched (Instagram withheld it, the
 *   downloader was throttled, the CDN link expired); sending it again later usually works.
 * - `unreadable`: anything else, ours to fix.
 */
export const recognitionErrorCodes = ["private", "temporarily_unavailable", "unreadable"] as const;
export type RecognitionErrorCode = (typeof recognitionErrorCodes)[number];

const PRIVATE = /returned a login page/i;
const MEDIA_UNAVAILABLE =
  /Could not fetch Instagram page|Could not extract media|Downloader:|TikTok downloader failed|Failed to fetch media|Media response body was empty|Post media could not be fetched/i;

export function recognitionErrorCode(task: Pick<RecognitionTaskRow, "status" | "error_message">): RecognitionErrorCode | null {
  if (task.status !== "failed") return null;
  const message = task.error_message ?? "";
  if (PRIVATE.test(message)) return "private";
  if (MEDIA_UNAVAILABLE.test(message)) return "temporarily_unavailable";
  return "unreadable";
}
