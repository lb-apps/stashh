import { inboundAttachmentsSchema, type InboundMessage } from "../conversation/events.ts";
import type { MessageStore, Settlement, StoredMessage } from "../conversation/store.ts";
import type { Db } from "./client.ts";
import type { InstagramMessageRow, Json } from "./types.ts";

/** `MessageStore` on the `instagram_messages` table. */
export class SupabaseMessageStore implements MessageStore {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insert(messages: InboundMessage[]): Promise<number> {
    if (messages.length === 0) return 0;
    const { data, error } = await this.db
      .from("instagram_messages")
      .upsert(
        messages.map((m) => ({
          mid: m.mid,
          account_id: m.accountId,
          sender_id: m.senderId,
          sent_at: m.sentAt.toISOString(),
          text: m.text,
          attachments: m.attachments as Json,
          payload: m.raw as Json,
        })),
        // Meta redelivers; a mid already stored keeps its state untouched.
        { onConflict: "mid", ignoreDuplicates: true },
      )
      .select("mid");
    if (error) throw new Error(`instagram_messages insert failed: ${error.message}`);
    return data.length;
  }

  async claim(limit: number, leaseSeconds: number): Promise<StoredMessage[]> {
    const { data, error } = await this.db.rpc("claim_instagram_messages", { p_limit: limit, p_lease_seconds: leaseSeconds });
    if (error) throw new Error(`claim_instagram_messages failed: ${error.message}`);
    return data.map(toStoredMessage);
  }

  async recordRepliesSent(mid: string, repliesSent: number): Promise<void> {
    const { error } = await this.db.from("instagram_messages").update({ replies_sent: repliesSent }).eq("mid", mid);
    if (error) throw new Error(`instagram_messages progress update failed: ${error.message}`);
  }

  async settle(mid: string, s: Settlement): Promise<void> {
    const { error } = await this.db
      .from("instagram_messages")
      .update({
        locked_until: null,
        ...(s.status !== undefined && { status: s.status }),
        ...(s.userId !== undefined && { user_id: s.userId }),
        ...(s.recognitionId !== undefined && { recognition_id: s.recognitionId }),
        ...(s.submittedAt !== undefined && { submitted_at: s.submittedAt.toISOString() }),
        ...(s.repliesSent !== undefined && { replies_sent: s.repliesSent }),
        ...(s.attempts !== undefined && { attempts: s.attempts }),
        ...(s.nextAttemptAt !== undefined && { next_attempt_at: s.nextAttemptAt.toISOString() }),
        ...(s.lastError !== undefined && { last_error: s.lastError }),
      })
      .eq("mid", mid);
    if (error) throw new Error(`instagram_messages settle failed: ${error.message}`);
  }

  async deleteBySender(senderId: string): Promise<void> {
    const { error } = await this.db.from("instagram_messages").delete().eq("sender_id", senderId);
    if (error) throw new Error(`instagram_messages erase failed: ${error.message}`);
  }

  async purgeCreatedBefore(cutoff: Date): Promise<number> {
    const { data, error } = await this.db
      .from("instagram_messages")
      .delete()
      .lt("created_at", cutoff.toISOString())
      .select("mid");
    if (error) throw new Error(`instagram_messages purge failed: ${error.message}`);
    return data.length;
  }
}

function toStoredMessage(row: InstagramMessageRow): StoredMessage {
  if (row.status !== "received" && row.status !== "submitted") {
    throw new Error(`claimed message ${row.mid} is not open (status ${row.status})`);
  }
  return {
    mid: row.mid,
    accountId: row.account_id,
    senderId: row.sender_id,
    sentAt: new Date(row.sent_at),
    text: row.text,
    attachments: inboundAttachmentsSchema.parse(row.attachments),
    status: row.status,
    userId: row.user_id,
    recognitionId: row.recognition_id,
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    repliesSent: row.replies_sent,
    attempts: row.attempts,
  };
}
