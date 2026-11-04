import type { CommandOutcome } from "../webhooks/core/commands.ts";
import type { InboundAttachment, InboundMessage } from "./events.ts";

/**
 * Where a message is in its life:
 * received → submitted → replied | failed, or expired once the reply window closed.
 */
export type MessageStatus = "received" | "submitted" | "replied" | "failed" | "expired";

/** A message as the webhook queues it: what Meta sent, and what the hooks relay said about it. */
export interface QueuedMessage extends InboundMessage {
  /** The relay routed it to this very instance (its sealed envelope named this environment). */
  relayRouted?: boolean;
  /** The `/env` command this message is, as the relay applied it. */
  relayCommand?: CommandOutcome | null;
}

/** An open message as a worker claims it. */
export interface StoredMessage {
  mid: string;
  accountId: string;
  senderId: string;
  sentAt: Date;
  text: string | null;
  attachments: InboundAttachment[];
  /** The hooks relay routed it here: outside production, the only messages that may be answered. */
  relayRouted: boolean;
  /** The `/env` command it is, answered with the relay's outcome; null for an ordinary message. */
  relayCommand: CommandOutcome | null;
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

/** What a message was read as; recorded so the ops stats can say what people ask for. */
export type MessageIntent = "recognize" | "help" | "unsupported" | "erase" | "link" | "env";

/**
 * The outcome of one processing step. Settling always releases the claim, and a final
 * status (replied, failed, expired) stamps the message's finish time.
 */
export interface Settlement {
  status?: MessageStatus;
  intent?: MessageIntent;
  userId?: string;
  recognitionId?: string;
  submittedAt?: Date;
  repliesSent?: number;
  attempts?: number;
  nextAttemptAt?: Date;
  lastError?: string | null;
}

/**
 * The message queue of one environment. Production and a dev instance share the table, so each
 * store writes its own environment on every message and claims only those: a dev worker never
 * takes production's messages, and production never takes a teammate's routed to dev.
 */
export interface MessageStore {
  /** Stores new messages; a mid seen before is ignored. Resolves to the number stored. */
  insert(messages: QueuedMessage[]): Promise<number>;
  /** Leases up to `limit` due open messages of this environment for `leaseSeconds`. */
  claim(limit: number, leaseSeconds: number): Promise<StoredMessage[]>;
  /** Records delivery progress without releasing the claim. */
  recordRepliesSent(mid: string, repliesSent: number): Promise<void>;
  settle(mid: string, settlement: Settlement): Promise<void>;
  /** Forgets everything a sender sent us (data erasure). */
  deleteBySender(senderId: string): Promise<void>;
  /** Retention: removes messages created before `cutoff`. Resolves to the number removed. */
  purgeCreatedBefore(cutoff: Date): Promise<number>;
}
