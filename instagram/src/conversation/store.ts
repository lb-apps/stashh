import type { InboundAttachment, InboundMessage } from "./events.ts";

/**
 * Where a message is in its life:
 * received → submitted → replied | failed, or expired once the reply window closed.
 */
export type MessageStatus = "received" | "submitted" | "replied" | "failed" | "expired";

/** An open message as a worker claims it. */
export interface StoredMessage {
  mid: string;
  accountId: string;
  senderId: string;
  sentAt: Date;
  text: string | null;
  attachments: InboundAttachment[];
  status: MessageStatus;
  /** Set once submitted: the Stashh user and recognition this message drives. */
  userId: string | null;
  recognitionId: string | null;
  submittedAt: Date | null;
  /** Replies already delivered, so a retried step never sends one twice. */
  repliesSent: number;
  /** Failed attempts so far; drives the retry backoff. */
  attempts: number;
}

/** The outcome of one processing step. Settling always releases the claim. */
export interface Settlement {
  status?: MessageStatus;
  userId?: string;
  recognitionId?: string;
  submittedAt?: Date;
  repliesSent?: number;
  attempts?: number;
  nextAttemptAt?: Date;
  lastError?: string | null;
}

export interface MessageStore {
  /** Stores new messages; a mid seen before is ignored. Resolves to the number stored. */
  insert(messages: InboundMessage[]): Promise<number>;
  /** Leases up to `limit` due open messages for `leaseSeconds`. */
  claim(limit: number, leaseSeconds: number): Promise<StoredMessage[]>;
  /** Records delivery progress without releasing the claim. */
  recordRepliesSent(mid: string, repliesSent: number): Promise<void>;
  settle(mid: string, settlement: Settlement): Promise<void>;
  /** Forgets everything a sender sent us (data erasure). */
  deleteBySender(senderId: string): Promise<void>;
  /** Retention: removes messages created before `cutoff`. Resolves to the number removed. */
  purgeCreatedBefore(cutoff: Date): Promise<number>;
}
