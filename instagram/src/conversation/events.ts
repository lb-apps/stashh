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

const messageSchema = z.looseObject({
  mid: z.string().min(1),
  text: z.string().optional(),
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
});

const changeSchema = z.looseObject({ field: z.string(), value: messagingEventSchema });

export type InboundAttachment = z.infer<typeof attachmentSchema>;

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
  /** Raw event, persisted verbatim for audit and replay. */
  raw: unknown;
}

function toDate(timestamp: number | string): Date {
  const value = typeof timestamp === "string" ? Number(timestamp) : timestamp;
  // Seconds vs milliseconds: anything before 2001 in ms is really seconds.
  return new Date(value < 1e12 ? value * 1000 : value);
}

/**
 * Extracts the inbound messages a delivery carries. Echoes of our own sends,
 * deletions and events without a message (reads, reactions) are dropped here,
 * so they are never stored.
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
      if (!event.success || !event.data.message) continue;

      const { sender, recipient, timestamp, message } = event.data;
      const isOwnSend = message.is_echo === true || sender.id === entry.id;
      if (isOwnSend || message.is_deleted === true) continue;

      messages.push({
        mid: message.mid,
        accountId: recipient.id,
        senderId: sender.id,
        sentAt: toDate(timestamp),
        text: message.text ?? null,
        attachments: message.attachments ?? [],
        raw,
      });
    }
  }

  return messages;
}
