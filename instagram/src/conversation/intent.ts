import type { RecognitionSource } from "../stashh/client.ts";
import type { InboundAttachment } from "./events.ts";

/** What a person wants from a message, decided before any side effect. */
export type Intent =
  /** Find the places in a Reel, a shared post or a pasted link. */
  | { kind: "recognize"; source: RecognitionSource }
  /** Erase everything Stashh holds about the sender ("sil"). */
  | { kind: "erase" }
  /** A share type we cannot read yet (stories). */
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
 * media id that Instagram Login cannot resolve, so the media itself is the source.
 */
function sharedSource(attachment: InboundAttachment): RecognitionSource | null {
  const url = attachment.payload?.url;
  if (!url) return null;
  if (PERMALINK_ATTACHMENTS.has(attachment.type)) {
    return LINK_PATTERN.test(url) ? { kind: "url", url } : null;
  }
  const mediaId = attachment.payload?.["ig_post_media_id"];
  if (attachment.type === "ig_post" && typeof mediaId === "string" && mediaId) {
    return { kind: "instagram_media", mediaId, mediaUrl: url, caption: attachment.payload?.title ?? null };
  }
  return null;
}
