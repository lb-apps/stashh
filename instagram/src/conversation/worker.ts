import { setTimeout as sleep } from "node:timers/promises";
import type { Logger } from "../lib/logger.ts";
import type { MessageStore, StoredMessage } from "./store.ts";

export interface WorkerOptions {
  store: MessageStore;
  process: (message: StoredMessage) => Promise<void>;
  log: Logger;
  /** Messages processed at once. */
  concurrency?: number;
  /** How long a claim lasts; must exceed the slowest single step. */
  leaseSeconds?: number;
  /** Wait between empty polls. */
  idleMs?: number;
}

/**
 * Drains the message queue: claims due messages up to `concurrency`, runs each one
 * step, and polls again. A crashed process loses nothing — its claims lapse and
 * another worker (or the restarted one) picks the messages up.
 */
export class MessageWorker {
  private readonly store: MessageStore;
  private readonly process: (message: StoredMessage) => Promise<void>;
  private readonly log: Logger;
  private readonly concurrency: number;
  private readonly leaseSeconds: number;
  private readonly idleMs: number;
  private readonly inFlight = new Set<Promise<void>>();
  private readonly stopping = new AbortController();
  private loop: Promise<void> | null = null;

  constructor(options: WorkerOptions) {
    this.store = options.store;
    this.process = options.process;
    this.log = options.log;
    this.concurrency = options.concurrency ?? 4;
    this.leaseSeconds = options.leaseSeconds ?? 120;
    this.idleMs = options.idleMs ?? 1_000;
  }

  /** Messages being processed by this instance right now. */
  get inFlightCount(): number {
    return this.inFlight.size;
  }

  start(): void {
    this.loop ??= this.run();
  }

  /** Stops claiming and waits for the messages in hand to finish. */
  async stop(): Promise<void> {
    this.stopping.abort();
    await this.loop;
  }

  private async run(): Promise<void> {
    while (!this.stopping.signal.aborted) {
      const free = this.concurrency - this.inFlight.size;
      let claimed: StoredMessage[] = [];
      if (free > 0) {
        try {
          claimed = await this.store.claim(free, this.leaseSeconds);
        } catch (error) {
          this.log.error({ err: error }, "claiming messages failed");
        }
      }

      for (const message of claimed) {
        const task = this.process(message)
          .catch((error: unknown) => {
            // The processor settles its own failures; reaching here means settling failed too.
            // The claim lapses and the message is retried.
            this.log.error({ err: error, mid: message.mid }, "message step crashed");
          })
          .finally(() => this.inFlight.delete(task));
        this.inFlight.add(task);
      }

      // Busy: go straight back for more. Idle or full: wait for time or a free slot.
      if (claimed.length === 0 || this.inFlight.size >= this.concurrency) {
        await Promise.race([sleep(this.idleMs, undefined, { signal: this.stopping.signal }).catch(() => {}), ...this.inFlight]);
      }
    }
    await Promise.allSettled(this.inFlight);
  }
}
