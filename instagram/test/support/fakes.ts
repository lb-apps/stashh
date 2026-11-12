import type { DmEventName, DmEventProps } from "../../src/analytics/events.ts";
import type { Analytics, DmProfile, EventAt } from "../../src/analytics/mixpanel.ts";
import type { MessageStore, QueuedMessage, Settlement, StoredMessage } from "../../src/conversation/store.ts";
import type { InstagramProfile, Messenger, OutboundMessage, ProfileReader, QuickReply, SenderAction } from "../../src/meta/graph-client.ts";
import type { Recognition, RecognitionSource, ReplyPlan, StashhApi, TurnMessage } from "../../src/stashh/client.ts";

interface Row extends StoredMessage {
  nextAttemptAt: Date;
  lockedUntil: Date | null;
  lastError: string | null;
  createdAt: Date;
  intent: string | null;
  finishedAt: Date | null;
}

const FINAL_STATUSES = new Set(["replied", "failed", "expired"]);

/** MessageStore with the same claim semantics as `claim_instagram_messages`. */
export class MemoryStore implements MessageStore {
  readonly rows = new Map<string, Row>();
  private readonly now: () => Date;

  constructor(now: () => Date) {
    this.now = now;
  }

  async insert(messages: QueuedMessage[]): Promise<number> {
    let stored = 0;
    for (const m of messages) {
      if (this.rows.has(m.mid)) continue;
      this.rows.set(m.mid, {
        mid: m.mid,
        accountId: m.accountId,
        senderId: m.senderId,
        sentAt: m.sentAt,
        text: m.text,
        attachments: m.attachments,
        tapped: m.tapped ?? null,
        relayRouted: m.relayRouted ?? false,
        relayCommand: m.relayCommand ?? null,
        status: "received",
        userId: null,
        recognitionId: null,
        submittedAt: null,
        repliesSent: 0,
        attempts: 0,
        nextAttemptAt: this.now(),
        lockedUntil: null,
        lastError: null,
        createdAt: this.now(),
        intent: null,
        finishedAt: null,
      });
      stored += 1;
    }
    return stored;
  }

  async claim(limit: number, leaseSeconds: number): Promise<StoredMessage[]> {
    const now = this.now();
    const leased = (row: Row) => row.lockedUntil !== null && row.lockedUntil > now;
    const senderLeased = (row: Row) => [...this.rows.values()].some((other) => other.mid !== row.mid && other.senderId === row.senderId && leased(other));
    const due = [...this.rows.values()]
      .filter((r) => (r.status === "received" || r.status === "submitted") && r.nextAttemptAt <= now)
      .filter((r) => !leased(r))
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime() || a.sentAt.getTime() - b.sentAt.getTime());
    const claimed: Row[] = [];
    for (const row of due) {
      if (claimed.length >= limit) break;
      if (senderLeased(row)) continue;
      row.lockedUntil = new Date(now.getTime() + leaseSeconds * 1000);
      claimed.push(row);
    }
    return claimed.map((r) => ({ ...r }));
  }

  async claimSender(senderId: string, leaseSeconds: number): Promise<StoredMessage[]> {
    const now = this.now();
    const due = [...this.rows.values()]
      .filter((r) => r.senderId === senderId && r.status === "received" && r.nextAttemptAt <= now)
      .filter((r) => !r.lockedUntil || r.lockedUntil < now)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    for (const r of due) r.lockedUntil = new Date(now.getTime() + leaseSeconds * 1000);
    return due.map((r) => ({ ...r }));
  }

  async recordRepliesSent(mid: string, repliesSent: number): Promise<void> {
    const row = this.rows.get(mid);
    if (row) row.repliesSent = repliesSent;
  }

  async settle(mid: string, s: Settlement): Promise<void> {
    const row = this.rows.get(mid);
    if (!row) return;
    Object.assign(row, Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)), { lockedUntil: null });
    // Same rule as the database constraint: a final status carries its finish time.
    if (s.status && FINAL_STATUSES.has(s.status)) row.finishedAt = this.now();
  }

  async deleteBySender(senderId: string): Promise<void> {
    for (const [mid, row] of this.rows) if (row.senderId === senderId) this.rows.delete(mid);
  }

  async purgeCreatedBefore(cutoff: Date): Promise<number> {
    let removed = 0;
    for (const [mid, row] of this.rows) {
      if (row.createdAt < cutoff) {
        this.rows.delete(mid);
        removed += 1;
      }
    }
    return removed;
  }

  row(mid: string): Row {
    const row = this.rows.get(mid);
    if (!row) throw new Error(`no row ${mid}`);
    return row;
  }
}

type Step<T> = T | Error;

/** StashhApi whose responses are queued per method; an Error in the queue is thrown. */
export class FakeStashh implements StashhApi {
  resolved: string[] = [];
  resolvedProfiles: Array<InstagramProfile | null | undefined> = [];
  /** Senders who already have a Stashh user; the first resolve creates one (`created: true`). */
  accounts = new Set<string>();
  /** Users the backend knows, by IGSID, with their stored profile (null until one is stored). */
  users = new Map<string, InstagramProfile | null>();
  listCalls: Array<{ syncedBefore: Date; after?: string; limit: number }> = [];
  erased: string[] = [];
  created: Array<{ userId: string; source: RecognitionSource; idempotencyKey: string }> = [];
  createSteps: Array<Step<{ recognitionId: string }>> = [];
  getSteps: Array<Step<Recognition>> = [];
  eraseSteps: Array<Step<void>> = [];
  minted: string[] = [];
  mintSteps: Array<Step<{ url: string }>> = [];
  /** Assistant turns asked for, with their messages. */
  turns: Array<{ userId: string; messages: TurnMessage[] }> = [];
  turnSteps: Array<Step<ReplyPlan>> = [];

  async resolveInstagramUser(igsid: string, profile?: InstagramProfile | null) {
    this.resolved.push(igsid);
    this.resolvedProfiles.push(profile);
    const created = !this.accounts.has(igsid);
    this.accounts.add(igsid);
    return { userId: "00000000-0000-4000-8000-000000000001", created };
  }

  async updateInstagramProfile(igsid: string, profile: InstagramProfile) {
    if (!this.users.has(igsid)) return false;
    this.users.set(igsid, profile);
    return true;
  }

  /** Every known user counts as stale; pages in id order like the backend. */
  async listProfileStaleInstagramUsers(params: { syncedBefore: Date; after?: string; limit: number }) {
    this.listCalls.push(params);
    return [...this.users.keys()]
      .sort()
      .filter((id) => params.after === undefined || id > params.after)
      .slice(0, params.limit);
  }

  async eraseInstagramUser(igsid: string) {
    const step = this.eraseSteps.shift();
    if (step instanceof Error) throw step;
    this.erased.push(igsid);
    this.accounts.delete(igsid);
    return { userId: "00000000-0000-4000-8000-000000000001" };
  }

  async createRecognition(params: { userId: string; source: RecognitionSource; idempotencyKey: string }) {
    const step = this.createSteps.shift() ?? { recognitionId: "00000000-0000-4000-8000-0000000000aa" };
    if (step instanceof Error) throw step;
    this.created.push(params);
    return step;
  }

  async mintSignInLink(userId: string) {
    const step = this.mintSteps.shift() ?? { url: `https://stashh.me/app/a/${"c".repeat(31)}${this.minted.length}` };
    if (step instanceof Error) throw step;
    this.minted.push(userId);
    return step;
  }

  async getRecognition() {
    const step = this.getSteps.shift();
    if (!step) throw new Error("unexpected getRecognition");
    if (step instanceof Error) throw step;
    return step;
  }

  async assistantTurn(params: { userId: string; messages: TurnMessage[] }) {
    const step = this.turnSteps.shift() ?? { messages: [{ kind: "text" as const, text: `assistant: ${params.messages.map((m) => m.text).join(" | ")}` }] };
    if (step instanceof Error) throw step;
    this.turns.push(params);
    return step;
  }
}

export class FakeMessenger implements Messenger {
  sent: Array<{ to: string; message: OutboundMessage }> = [];
  /** Every presence signal sent, in order. */
  actions: Array<{ to: string; action: SenderAction }> = [];
  /** Errors to throw on upcoming sends, in order; `undefined` lets that send succeed. */
  sendSteps: Array<Error | undefined> = [];

  async send(recipientId: string, message: OutboundMessage): Promise<void> {
    const step = this.sendSteps.shift();
    if (step) throw step;
    this.sent.push({ to: recipientId, message });
  }

  async senderAction(recipientId: string, action: SenderAction): Promise<void> {
    this.actions.push({ to: recipientId, action });
  }

  /** Who got the typing bubble, once per signal. */
  get typed(): string[] {
    return this.actions.filter((a) => a.action === "typing_on").map((a) => a.to);
  }

  /** What was said in words: text messages and the text above a button message. */
  texts(): string[] {
    return this.sent.flatMap(({ message }) => (message.kind === "text" || message.kind === "button" ? [message.text] : []));
  }

  /** Every link button sent under a text, as title → url. */
  buttons(): Array<{ title: string; url: string }> {
    return this.sent.flatMap(({ message }) =>
      message.kind === "button" ? message.buttons.flatMap((b) => (b.type === "postback" ? [] : [{ title: b.title, url: b.url }])) : [],
    );
  }

  /** The quick replies on each sent message, in send order (empty where a message had none). */
  quickReplies(): QuickReply[][] {
    return this.sent.map(({ message }) => (message.kind === "carousel" ? [] : (message.quickReplies ?? [])));
  }
}

/** ProfileReader answering from a map; an Error value is thrown for that IGSID. */
export class FakeProfiles implements ProfileReader {
  answers = new Map<string, InstagramProfile | null | Error>();
  reads: string[] = [];

  async profile(igsid: string): Promise<InstagramProfile | null> {
    this.reads.push(igsid);
    const answer = this.answers.get(igsid) ?? null;
    if (answer instanceof Error) throw answer;
    return answer;
  }
}

/** Analytics that records every call instead of sending it. */
export class FakeAnalytics implements Analytics {
  events: Array<{ name: DmEventName; props: Record<string, unknown> } & EventAt> = [];
  profiles: Array<{ userId: string; profile: DmProfile }> = [];
  deleted: string[] = [];

  track<N extends DmEventName>(name: N, props: DmEventProps<N>, at: EventAt): void {
    this.events.push({ name, props: { ...props }, ...at });
  }

  setProfile(userId: string, profile: DmProfile): void {
    this.profiles.push({ userId, profile });
  }

  deleteProfile(userId: string): void {
    this.deleted.push(userId);
  }

  async flush(): Promise<void> {}

  names(): DmEventName[] {
    return this.events.map((event) => event.name);
  }

  /** The recorded events of one name. */
  of(name: DmEventName) {
    return this.events.filter((event) => event.name === name);
  }
}

/** A controllable clock. */
export function clock(start = "2026-10-14T12:00:00.000Z") {
  let current = new Date(start);
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}
