/**
 * The links Stashh can read, checked before anything is sent. Mirrors the
 * backend's `isSupportedSourceUrl` (`backend/src/modules/recognitions/types.ts`):
 * an Instagram post, Reel or IGTV permalink (optionally under a username), or
 * any TikTok link. Story links are refused there, so they are refused here.
 */
const INSTAGRAM_PERMALINK = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(p|reels?|tv)\/[A-Za-z0-9_-]+/i;
const TIKTOK_URL = /^https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\//i;

/** The first thing in a paste that looks like a link — share sheets often add a caption around it. */
const LINK_IN_TEXT = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:instagram|tiktok)\.com\/\S+/i;

export type SourcePlatform = "instagram" | "tiktok";
/** What the link points at, for copy ("that Reel", "that post", "that video"). */
export type SourceKind = "reel" | "post" | "video";

export interface SourceLink {
  url: string;
  platform: SourcePlatform;
  kind: SourceKind;
}

/** Reads a supported link out of pasted or typed text; null when there is none. */
export function parseSourceLink(text: string): SourceLink | null {
  const found = LINK_IN_TEXT.exec(text.trim())?.[0];
  if (!found) return null;
  const url = /^https?:\/\//i.test(found) ? found : `https://${found}`;
  const instagram = INSTAGRAM_PERMALINK.exec(url);
  if (instagram) return { url, platform: "instagram", kind: instagram[1].toLowerCase() === "p" ? "post" : "reel" };
  if (TIKTOK_URL.test(url)) return { url, platform: "tiktok", kind: "video" };
  return null;
}
