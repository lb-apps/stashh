import type { Logger } from "../lib/logger.ts";
import { GraphApiError, type Messenger, type OutboundMessage } from "../meta/graph-client.ts";
import { composeRecognitionReply } from "../replies/compose.ts";
import { copy, sourceKindOf, type SourceKind } from "../replies/copy.tr.ts";
import { StashhApiError, TERMINAL_STATUSES, type StashhApi } from "../stashh/client.ts";
import { interpret } from "./intent.ts";
import type { MessageStatus, MessageStore, Settlement, StoredMessage } from "./store.ts";

/** Instagram only lets a business reply within 24 hours of the person's message. */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** A recognition normally takes 10–60 s; past this we stop waiting and apologise. */
const RECOGNITION_TIMEOUT_MS = 5 * 60 * 1000;
/** Failed attempts before a message is given up on. */
const MAX_ATTEMPTS = 8;

export interface ProcessorDeps {
  store: MessageStore;
  stashh: StashhApi;
  messenger: Messenger;
  log: Logger;
  now?: () => Date;
}

/**
 * Advances one claimed message by one step of its state machine:
 *
 *   received  ── help / unsupported ──▶ reply ──▶ replied
 *             ── erase ──▶ erase user, reply, forget the sender
 *             ── recognize ──▶ create recognition (idempotent on mid) ──▶ submitted
 *   submitted ── still running ──▶ poll again later
 *             ── completed ──▶ reply with places ──▶ replied
 *             ── failed / timed out ──▶ apologise ──▶ failed
 *
 * Every step is safe to repeat: identity resolution and recognition creation are
 * idempotent on the backend, and delivered replies are counted so a retry resumes
 * where it stopped. Every exit settles the message, which releases the claim.
 */
export class MessageProcessor {
  private readonly store: MessageStore;
  private readonly stashh: StashhApi;
  private readonly messenger: Messenger;
  private readonly log: Logger;
  private readonly now: () => Date;

  constructor(deps: ProcessorDeps) {
    this.store = deps.store;
    this.stashh = deps.stashh;
    this.messenger = deps.messenger;
    this.log = deps.log;
    this.now = deps.now ?? (() => new Date());
  }

  async process(message: StoredMessage): Promise<void> {
    const log = this.log.child({ mid: message.mid, status: message.status });

    if (this.now().getTime() - message.sentAt.getTime() > REPLY_WINDOW_MS) {
      log.warn("reply window closed; message expired");
      await this.settle(message, { status: "expired" });
      return;
    }

    try {
      if (message.status === "submitted") await this.poll(message);
      else await this.start(message);
    } catch (error) {
      await this.fail(message, error, log);
    }
  }

  private async start(message: StoredMessage): Promise<void> {
    const intent = interpret(message);

    switch (intent.kind) {
      case "help":
        return this.reply(message, [text(copy.help)]);
      case "unsupported":
        return this.reply(message, [text(copy.unsupported)]);
      case "erase":
        await this.stashh.eraseInstagramUser(message.senderId);
        await this.reply(message, [text(copy.erased)]);
        await this.store.deleteBySender(message.senderId);
        return;
      case "recognize": {
        // Cosmetic; never worth failing the message over.
        await this.messenger.typing(message.senderId).catch((error: unknown) => {
          this.log.debug({ err: error, mid: message.mid }, "typing indicator not sent");
        });
        const { userId } = await this.stashh.resolveInstagramUser(message.senderId);
        const { recognitionId } = await this.stashh.createRecognition({
          userId,
          source: intent.source,
          idempotencyKey: message.mid,
        });
        const now = this.now();
        await this.settle(message, {
          status: "submitted",
          userId,
          recognitionId,
          submittedAt: now,
          attempts: 0,
          lastError: null,
          nextAttemptAt: new Date(now.getTime() + pollDelayMs(0)),
        });
        return;
      }
    }
  }

  private async poll(message: StoredMessage): Promise<void> {
    if (!message.userId || !message.recognitionId || !message.submittedAt) {
      throw new Error("submitted message is missing its recognition");
    }
    const kind = this.sourceKind(message);
    const recognition = await this.stashh.getRecognition({ userId: message.userId, recognitionId: message.recognitionId });

    if (recognition.status === "completed" || recognition.status === "committed") {
      return this.reply(message, composeRecognitionReply(recognition.places ?? [], kind));
    }
    if (TERMINAL_STATUSES.has(recognition.status)) {
      return this.reply(message, [text(copy.failed(kind))], "failed", recognition.error_message ?? `recognition ${recognition.status}`);
    }

    const now = this.now();
    const elapsed = now.getTime() - message.submittedAt.getTime();
    if (elapsed > RECOGNITION_TIMEOUT_MS) {
      return this.reply(message, [text(copy.failed(kind))], "failed", `recognition timed out after ${Math.round(elapsed / 1000)}s`);
    }
    await this.settle(message, { nextAttemptAt: new Date(now.getTime() + pollDelayMs(elapsed)) });
  }

  /** Sends what has not been delivered yet, then settles the message. */
  private async reply(
    message: StoredMessage,
    replies: OutboundMessage[],
    status: MessageStatus = "replied",
    lastError: string | null = null,
  ): Promise<void> {
    for (let i = message.repliesSent; i < replies.length; i++) {
      await this.messenger.send(message.senderId, replies[i]!);
      await this.store.recordRepliesSent(message.mid, i + 1);
    }
    await this.settle(message, { status, repliesSent: Math.max(replies.length, message.repliesSent), lastError });
  }

  private async fail(message: StoredMessage, error: unknown, log: Logger): Promise<void> {
    const attempts = message.attempts + 1;
    const lastError = error instanceof Error ? error.message : String(error);

    if (isRetryable(error) && attempts < MAX_ATTEMPTS) {
      const delay = retryDelayMs(attempts);
      log.warn({ err: error, attempts, retryInMs: delay }, "step failed; will retry");
      await this.settle(message, { attempts, lastError, nextAttemptAt: new Date(this.now().getTime() + delay) });
      return;
    }

    log.error({ err: error, attempts }, "message failed");
    // A Graph API failure means we cannot reach the person, so there is no one to apologise to.
    if (!(error instanceof GraphApiError)) {
      await this.messenger.send(message.senderId, text(copy.failed(this.sourceKind(message)))).catch((sendError: unknown) => {
        log.warn({ err: sendError }, "apology not sent");
      });
    }
    await this.settle(message, { status: "failed", attempts, lastError });
  }

  /** Settles with the message's intent, so every outcome is attributed to what was asked. */
  private settle(message: StoredMessage, settlement: Settlement): Promise<void> {
    return this.store.settle(message.mid, { intent: interpret(message).kind, ...settlement });
  }

  private sourceKind(message: StoredMessage): SourceKind {
    const intent = interpret(message);
    return intent.kind === "recognize" ? sourceKindOf(intent.source) : "reel";
  }
}

const text = (value: string): OutboundMessage => ({ kind: "text", text: value });

/** Unknown errors (a bug, the database) are retried; API errors say for themselves. */
function isRetryable(error: unknown): boolean {
  if (error instanceof StashhApiError || error instanceof GraphApiError) return error.retryable;
  return true;
}

/** Poll quickly while a recognition is likely to finish, then settle into a slower pace. */
function pollDelayMs(elapsedMs: number): number {
  if (elapsedMs < 10_000) return 2_000;
  if (elapsedMs < 30_000) return 5_000;
  return 10_000;
}

/** 5 s, 10 s, 20 s … capped at 10 minutes. */
function retryDelayMs(attempts: number): number {
  return Math.min(5_000 * 2 ** (attempts - 1), 10 * 60_000);
}
