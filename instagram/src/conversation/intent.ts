import type { RecognitionSource } from "../stashh/client.ts";
import type { InboundAttachment } from "./events.ts";

/** What a person wants from a message, decided before any side effect. */
export type Intent =
  /** Find the places in a Reel, a shared post or story, or a pasted link. */
  | { kind: "recognize"; source: RecognitionSource }
  /** Erase everything Stashh holds about the sender ("sil"). */
  | { kind: "erase" }
  /** A share that carries nothing we can read (no media link, no id). */
  | { kind: "unsupported"; attachmentType: string }
  /** Anything else: explain what Stashh does. */
  | { kind: "help" };

const ERASE_COMMANDS = new Set(["sil", "delete"]);

// Links the backend accepts; kept in step with backend/src/modules/recognitions/types.ts.
const LINK_PATTERN =
  /https?:\/\/(?:www\.)?(?:instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reels?|tv)\/[A-Za-z0-9_-]+\/?|(?:[a-z0-9-]+\.)*tiktok\.com\/\S+)/i;

/** Attachment types that carry a readable permalink in `payload.url`. */
const PERMALINK_ATTACHMENTS = new Set(["ig_reel"]);

export function interpret(message: { text: string | null; attachments: InboundAttachment[] }): Intent {
  for (const attachment of message.attachments) {
    const source = sharedSource(attachment);
    if (source) return { kind: "recognize", source };
  }

  const text = message.text?.trim() ?? "";
  if (ERASE_COMMANDS.has(text.toLocaleLowerCase("tr"))) return { kind: "erase" };

  const link = text.match(LINK_PATTERN)?.[0];
  if (link) return { kind: "recognize", source: { kind: "url", url: link } };

  const firstAttachment = message.attachments[0];
  if (firstAttachment) return { kind: "unsupported", attachmentType: firstAttachment.type };

  return { kind: "help" };
}

/**
 * What a shared attachment lets us read. A Reel carries its public permalink. A feed
 * post carries no permalink, only a signed CDN link to its media, the caption and a
 * media id that Instagram Login cannot resolve, so the media itself is the source. A
 * story share (`ig_story`) carries the story's media link and id; a story mention
 * carries only the link, whose `asset_id` is the same id.
 */
function sharedSource(attachment: InboundAttachment): RecognitionSource | null {
  const payload = attachment.payload ?? {};
  if (PERMALINK_ATTACHMENTS.has(attachment.type)) {
    return payload.url && LINK_PATTERN.test(payload.url) ? { kind: "url", url: payload.url } : null;
  }
  if (attachment.type === "ig_post") {
    const mediaId = payload["ig_post_media_id"];
    if (!payload.url || typeof mediaId !== "string" || !mediaId) return null;
    return { kind: "instagram_media", format: "post", mediaId, mediaUrl: payload.url, caption: payload.title ?? null };
  }
  if (attachment.type === "ig_story" || attachment.type === "story_mention") {
    const mediaUrl = attachment.type === "ig_story" ? payload["story_media_url"] : payload.url;
    if (typeof mediaUrl !== "string" || !mediaUrl) return null;
    const declared = payload["story_media_id"];
    const mediaId = typeof declared === "string" && declared ? declared : assetIdOf(mediaUrl);
    return mediaId ? { kind: "instagram_media", format: "story", mediaId, mediaUrl, caption: null } : null;
  }
  return null;
}

/** The numeric `asset_id` Instagram's messaging CDN puts in every media link. */
function assetIdOf(mediaUrl: string): string | null {
  try {
    const id = new URL(mediaUrl).searchParams.get("asset_id");
    return id && /^\d{1,32}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
