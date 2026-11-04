import type { Logger } from "../lib/logger.ts";
import { GraphApiError, type InstagramProfile, type Messenger, type OutboundMessage, type ProfileReader, type SenderAction } from "../meta/graph-client.ts";
import { composeRecognitionReply, mapLinkMessage, renderPlan } from "../replies/compose.ts";
import { copy, sourceKindOf, type SourceKind } from "../replies/copy.tr.ts";
import { StashhApiError, TERMINAL_STATUSES, type StashhApi } from "../stashh/client.ts";
import { commandReply } from "../webhooks/core/commands.ts";
import { interpret } from "./intent.ts";
import { mayMessage, OUTBOUND_BLOCKED, type OutboundMode } from "./outbound.ts";
import type { MessageStatus, MessageStore, Settlement, StoredMessage } from "./store.ts";
import type { TurnMessage } from "../stashh/client.ts";

/** Instagram only lets a business reply within 24 hours of the person's message. */
const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
/** A recognition normally takes 10–60 s; past this we stop waiting and apologise. */
const RECOGNITION_TIMEOUT_MS = 5 * 60 * 1000;
/** Failed attempts before a message is given up on. */
const MAX_ATTEMPTS = 8;
/** A chat turn is retried less: the person is waiting, and the backend replays a finished turn anyway. */
const CHAT_MAX_ATTEMPTS = 3;
/** How long folded-in messages stay leased while the assistant answers; longer than a turn. */
const CHAT_LEASE_SECONDS = 120;
/**
 * A typed message waits this long before the assistant answers, so a person who sends three
 * short lines in a row gets one answer to all three (`claimSender` folds the later ones in).
 */
export const CHAT_DEBOUNCE_MS = 2_500;
/** Instagram drops the typing bubble after about 20 s; a long turn renews it before that. */
const TYPING_REFRESH_MS = 12_000;

export interface ProcessorDeps {
  store: MessageStore;
  stashh: StashhApi;
  messenger: Messenger;
  profiles: ProfileReader;
  log: Logger;
  /** Who this instance may write to (`outbound.ts`); production is always `live`. */
  outbound?: OutboundMode;
  /** Quick replies under a finished recognition (`RECOGNITION_SUGGESTED_REPLIES`). */
  suggestedReplies?: boolean;
  now?: () => Date;
}

/**
 * Advances one claimed message by one step of its state machine:
 *
 *   received  ── not ours to answer (outbound.ts) ──▶ failed, nothing sent
 *             ── env (a relay /env command) ──▶ reply with what the relay did ──▶ replied
 *             ── help / unsupported ──▶ reply ──▶ replied
 *             ── chat (typed, or a tap) ──▶ fold in the sender's other due messages, ask the
 *                assistant, send its plan ──▶ replied
 *             ── link ──▶ resolve user, mint a sign-in link, reply ──▶ replied
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
  private readonly profiles: ProfileReader;
  private readonly log: Logger;
  private readonly outbound: OutboundMode;
  private readonly suggestedReplies: boolean;
  private readonly now: () => Date;

  constructor(deps: ProcessorDeps) {
    this.store = deps.store;
    this.stashh = deps.stashh;
    this.messenger = deps.messenger;
    this.profiles = deps.profiles;
    this.log = deps.log;
    this.outbound = deps.outbound ?? "live";
    this.suggestedReplies = deps.suggestedReplies ?? false;
    this.now = deps.now ?? (() => new Date());
  }

  async process(message: StoredMessage): Promise<void> {
    const log = this.log.child({ mid: message.mid, status: message.status });

    if (this.now().getTime() - message.sentAt.getTime() > REPLY_WINDOW_MS) {
      log.warn("reply window closed; message expired");
      await this.settle(message, { status: "expired" });
      return;
    }

    // Before any side effect: a blocked message costs no recognition and sends nothing.
    if (!mayMessage(this.outbound, message)) {
      log.warn({ outbound: this.outbound }, "sender not routed here by the hooks relay; not answered");
      await this.settle(message, { status: "failed", lastError: OUTBOUND_BLOCKED });
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
      case "env":
        return this.reply(message, [text(commandReply(intent.outcome))]);
      case "help":
        return this.reply(message, [text(copy.help)]);
      case "unsupported":
        return this.reply(message, [text(copy.unsupported)]);
      case "link": {
        const { userId } = await this.stashh.resolveInstagramUser(message.senderId);
        const { url } = await this.stashh.mintSignInLink(userId);
        return this.reply(message, [mapLinkMessage(copy.mapLink, url)]);
      }
      case "erase":
        await this.stashh.eraseInstagramUser(message.senderId);
        await this.reply(message, [text(copy.erased)]);
        await this.store.deleteBySender(message.senderId);
        return;
      case "chat":
        return this.chat(message);
      case "recognize": {
        const profile = await this.greet(message);
        const { userId } = await this.stashh.resolveInstagramUser(message.senderId, profile);
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

  /** "Seen", the typing bubble and the sender's profile, all best-effort, before the slow part of a step. */
  private async greet(message: StoredMessage): Promise<InstagramProfile | null> {
    const [, profile] = await Promise.all([
      this.presence(message, "mark_seen").then(() => this.presence(message, "typing_on")),
      // Names the user; the daily profile sweep fills in whatever this misses.
      this.profiles.profile(message.senderId).catch((error: unknown) => {
        this.log.warn({ err: error, mid: message.mid }, "sender profile not read");
        return null;
      }),
    ]);
    return profile;
  }

  /** A presence signal; cosmetic, never worth failing the message over. */
  private async presence(message: StoredMessage, action: SenderAction): Promise<void> {
    await this.messenger.senderAction(message.senderId, action).catch((error: unknown) => {
      this.log.debug({ err: error, mid: message.mid, action }, "sender action not sent");
    });
  }

  /** Keeps the typing bubble up while `work` runs longer than Instagram shows it for. */
  private async whileTyping<T>(message: StoredMessage, work: () => Promise<T>): Promise<T> {
    const refresh = setInterval(() => void this.presence(message, "typing_on"), TYPING_REFRESH_MS);
    try {
      return await work();
    } finally {
      clearInterval(refresh);
    }
  }

  /**
   * A conversational turn. The sender's other due messages are folded in so three quick lines
   * get one answer; the ones that are not chat (a share, a command) are released to run on their
   * own once this turn settles. The assistant's plan is sent through `reply`, so a retry resumes
   * where it stopped, and the backend replays a finished turn instead of running the model again.
   */
  private async chat(message: StoredMessage): Promise<void> {
    const now = this.now();
    const settleAt = message.sentAt.getTime() + CHAT_DEBOUNCE_MS;
    if (now.getTime() < settleAt) {
      // "Seen" and the typing bubble go up right away, so the wait for follow-ups is not silence.
      await this.presence(message, "mark_seen");
      await this.presence(message, "typing_on");
      await this.settle(message, { nextAttemptAt: new Date(settleAt) });
      return;
    }

    const turn: StoredMessage[] = [message];
    for (const sibling of await this.store.claimSender(message.senderId, CHAT_LEASE_SECONDS)) {
      if (sibling.mid === message.mid) continue;
      if (now.getTime() - sibling.sentAt.getTime() > REPLY_WINDOW_MS) {
        await this.store.settle(sibling.mid, { status: "expired", intent: interpret(sibling).kind });
      } else if (interpret(sibling).kind === "chat") {
        turn.push(sibling);
      } else {
        await this.store.settle(sibling.mid, {});
      }
    }
    turn.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    // The folded messages are answered through this one; they are done whatever happens next.
    for (const folded of turn) {
      if (folded.mid !== message.mid) {
        await this.store.settle(folded.mid, { status: "replied", intent: "chat", repliesSent: 0, lastError: `folded into ${message.mid}` });
      }
    }

    const profile = await this.greet(message);
    const { userId } = await this.stashh.resolveInstagramUser(message.senderId, profile);
    const plan = await this.whileTyping(message, () => this.stashh.assistantTurn({ userId, messages: turn.map(toTurnMessage) }));
    return this.reply(message, renderPlan(plan));
  }

  private async poll(message: StoredMessage): Promise<void> {
    if (!message.userId || !message.recognitionId || !message.submittedAt) {
      throw new Error("submitted message is missing its recognition");
    }
    const kind = this.sourceKind(message);
    const recognition = await this.stashh.getRecognition({ userId: message.userId, recognitionId: message.recognitionId });

    if (recognition.status === "completed" || recognition.status === "committed") {
      const places = recognition.places ?? [];
      // A list post shared from the feed reaches us as its cover only (Meta sends no other
      // slide and no permalink); the link, once pasted, is read in full.
      if (places.length === 0 && recognition.names_elsewhere && this.isSharedPost(message)) {
        return this.reply(message, [text(copy.listNeedsLink)]);
      }
      const mapUrl = places.length > 0 ? await this.mapUrl(message.userId, message.mid) : null;
      return this.reply(message, composeRecognitionReply(places, kind, { mapUrl, recognitionId: message.recognitionId, suggestedReplies: this.suggestedReplies }));
    }
    if (TERMINAL_STATUSES.has(recognition.status)) {
      return this.reply(message, [text(copy.failedBecause(recognition.error_code, kind))], "failed", recognition.error_message ?? `recognition ${recognition.status}`);
    }

    const now = this.now();
    const elapsed = now.getTime() - message.submittedAt.getTime();
    if (elapsed > RECOGNITION_TIMEOUT_MS) {
      return this.reply(message, [text(copy.failed(kind))], "failed", `recognition timed out after ${Math.round(elapsed / 1000)}s`);
    }
    // Still working: the typing bubble stays up for as long as the recognition takes.
    await this.presence(message, "typing_on");
    await this.settle(message, { nextAttemptAt: new Date(now.getTime() + pollDelayMs(elapsed)) });
  }

  /**
   * A sign-in link for the reply's map button. The places are saved either way, so a link
   * that cannot be minted drops the button rather than holding back the reply.
   */
  private async mapUrl(userId: string, mid: string): Promise<string | null> {
    try {
      return (await this.stashh.mintSignInLink(userId)).url;
    } catch (error) {
      this.log.warn({ err: error, mid }, "sign-in link not minted; replying without the map button");
      return null;
    }
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
    const chat = interpret(message).kind === "chat";

    if (isRetryable(error) && attempts < (chat ? CHAT_MAX_ATTEMPTS : MAX_ATTEMPTS)) {
      const delay = retryDelayMs(attempts);
      log.warn({ err: error, attempts, retryInMs: delay }, "step failed; will retry");
      await this.settle(message, { attempts, lastError, nextAttemptAt: new Date(this.now().getTime() + delay) });
      return;
    }

    log.error({ err: error, attempts }, "message failed");
    // A Graph API failure means we cannot reach the person, so there is no one to apologise to.
    if (!(error instanceof GraphApiError)) {
      const apology = chat ? copy.assistantUnavailable : copy.failed(this.sourceKind(message));
      await this.messenger.send(message.senderId, text(apology)).catch((sendError: unknown) => {
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

  /** A feed post shared from the Instagram app, as opposed to a pasted link, a Reel or a story. */
  private isSharedPost(message: StoredMessage): boolean {
    const intent = interpret(message);
    return intent.kind === "recognize" && intent.source.kind === "instagram_media" && intent.source.format === "post";
  }
}

const text = (value: string): OutboundMessage => ({ kind: "text", text: value });

/** A stored message as the assistant reads it: the typed text, or the tapped title with its payload. */
function toTurnMessage(message: StoredMessage): TurnMessage {
  return { externalId: message.mid, text: message.text?.trim() || message.tapped?.title || "", tapped: message.tapped };
}

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
