import type { InboundMessage } from "../../src/conversation/events.ts";
import type { MessageStore, Settlement, StoredMessage } from "../../src/conversation/store.ts";
import type { Messenger, OutboundMessage } from "../../src/meta/graph-client.ts";
import type { Recognition, RecognitionSource, StashhApi } from "../../src/stashh/client.ts";

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

  async insert(messages: InboundMessage[]): Promise<number> {
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
    const due = [...this.rows.values()]
      .filter((r) => (r.status === "received" || r.status === "submitted") && r.nextAttemptAt <= now)
      .filter((r) => !r.lockedUntil || r.lockedUntil < now)
      .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime())
      .slice(0, limit);
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
  erased: string[] = [];
  created: Array<{ userId: string; source: RecognitionSource; idempotencyKey: string }> = [];
  createSteps: Array<Step<{ recognitionId: string }>> = [];
  getSteps: Array<Step<Recognition>> = [];
  eraseSteps: Array<Step<void>> = [];

  async resolveInstagramUser(igsid: string) {
    this.resolved.push(igsid);
    return { userId: "00000000-0000-4000-8000-000000000001" };
  }

  async eraseInstagramUser(igsid: string) {
    const step = this.eraseSteps.shift();
    if (step instanceof Error) throw step;
    this.erased.push(igsid);
  }

  async createRecognition(params: { userId: string; source: RecognitionSource; idempotencyKey: string }) {
    const step = this.createSteps.shift() ?? { recognitionId: "00000000-0000-4000-8000-0000000000aa" };
    if (step instanceof Error) throw step;
    this.created.push(params);
    return step;
  }

  async getRecognition() {
    const step = this.getSteps.shift();
    if (!step) throw new Error("unexpected getRecognition");
    if (step instanceof Error) throw step;
    return step;
  }
}

export class FakeMessenger implements Messenger {
  sent: Array<{ to: string; message: OutboundMessage }> = [];
  typed: string[] = [];
  /** Errors to throw on upcoming sends, in order; `undefined` lets that send succeed. */
  sendSteps: Array<Error | undefined> = [];

  async send(recipientId: string, message: OutboundMessage): Promise<void> {
    const step = this.sendSteps.shift();
    if (step) throw step;
    this.sent.push({ to: recipientId, message });
  }

  async typing(recipientId: string): Promise<void> {
    this.typed.push(recipientId);
  }

  texts(): string[] {
    return this.sent.flatMap(({ message }) => (message.kind === "text" ? [message.text] : []));
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
