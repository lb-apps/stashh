import { createHash } from "node:crypto";
import { z } from "zod";
import type { WebhookEnvelope } from "../webhooks/routes.ts";

/**
 * Instagram Messaging webhook events, normalised.
 *
 * Meta delivers the same event in two shapes: real traffic as
 * `entry[].messaging[]`, and the dashboard's Test tool as
 * `entry[].changes[{ field: "messages", value }]`. Both are accepted so the
 * dashboard test exercises the real path.
 */

const attachmentSchema = z.looseObject({
  type: z.string(),
  payload: z.looseObject({ url: z.string().optional(), title: z.string().optional() }).optional(),
});

/** A tap on one of our quick replies: the message carries the title as text and the payload here. */
const quickReplySchema = z.looseObject({ payload: z.string() });

const messageSchema = z.looseObject({
  mid: z.string().min(1),
  text: z.string().optional(),
  quick_reply: quickReplySchema.optional(),
  is_echo: z.boolean().optional(),
  is_deleted: z.boolean().optional(),
  is_unsupported: z.boolean().optional(),
  attachments: z.array(attachmentSchema).optional(),
});

const messagingEventSchema = z.looseObject({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  // Real events carry epoch milliseconds as a number; the Test tool sends a string.
  timestamp: z.union([z.number(), z.string()]),
  message: messageSchema.optional(),
  /** A tap on a template button, an ice breaker or the persistent menu: no `message`, a `postback`. */
  postback: z.looseObject({ mid: z.string().min(1).optional(), title: z.string(), payload: z.string() }).optional(),
});

const changeSchema = z.looseObject({ field: z.string(), value: messagingEventSchema });

export type InboundAttachment = z.infer<typeof attachmentSchema>;

/** What the person tapped, when the message is a tap rather than something typed. */
export interface Tapped {
  title: string;
  payload: string;
}

/** Attachments as stored with a message; re-validated when a worker loads it. */
export const inboundAttachmentsSchema = z.array(attachmentSchema);

/** One message a person sent to our account. */
export interface InboundMessage {
  mid: string;
  /** Our Instagram professional account id (the webhook entry id). */
  accountId: string;
  /** The sender's Instagram-scoped id (IGSID). */
  senderId: string;
  sentAt: Date;
  text: string | null;
  attachments: InboundAttachment[];
  /** The quick reply or button tapped; absent for a typed message or a share. */
  tapped?: Tapped | null;
  /** Raw event, persisted verbatim for audit and replay. */
  raw: unknown;
}

function toDate(timestamp: number | string): Date {
  const value = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  // Seconds vs milliseconds: anything before 2001 in ms is really seconds.
  return new Date(value < 1e12 ? value * 1000 : value);
}

/**
 * Extracts the inbound messages a delivery carries: typed messages, shares, quick-reply
 * taps and button postbacks. Echoes of our own sends, deletions and events that carry
 * neither a message nor a postback (reads, reactions) are dropped here, so they are never
 * stored. A postback without a `mid` gets a deterministic id, so a redelivery is still a duplicate.
 */
export function extractInboundMessages(envelope: WebhookEnvelope): InboundMessage[] {
  const messages: InboundMessage[] = [];

  for (const entry of envelope.entry) {
    const rawEvents: unknown[] = [];
    const record = entry as Record<string, unknown>;
    if (Array.isArray(record["messaging"])) rawEvents.push(...record["messaging"]);
    if (Array.isArray(record["changes"])) {
      for (const change of record["changes"]) {
        const parsed = changeSchema.safeParse(change);
        if (parsed.success && parsed.data.field === "messages") rawEvents.push(parsed.data.value);
      }
    }

    for (const raw of rawEvents) {
      const event = messagingEventSchema.safeParse(raw);
      if (!event.success) continue;
      const { sender, recipient, timestamp, message, postback } = event.data;
      if (sender.id === entry.id) continue;

      if (message) {
        if (message.is_echo === true || message.is_deleted === true) continue;
        messages.push({
          mid: message.mid,
          accountId: recipient.id,
          senderId: sender.id,
          sentAt: toDate(timestamp),
          text: message.text ?? null,
          attachments: message.attachments ?? [],
          tapped: message.quick_reply ? { title: message.text ?? "", payload: message.quick_reply.payload } : null,
          raw,
        });
      } else if (postback) {
        messages.push({
          mid: postback.mid ?? `postback:${sender.id}:${String(timestamp)}:${createHash("sha256").update(postback.payload).digest("hex").slice(0, 16)}`,
          accountId: recipient.id,
          senderId: sender.id,
          sentAt: toDate(timestamp),
          text: postback.title,
          attachments: [],
          tapped: { title: postback.title, payload: postback.payload },
          raw,
        });
      }
    }
  }

  return messages;
}
