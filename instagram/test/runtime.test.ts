import { readFileSync } from "node:fs";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import type { StoredMessage } from "../src/conversation/store.ts";
import { MessageWorker } from "../src/conversation/worker.ts";
import { isRefreshDue } from "../src/meta/token-store.ts";
import type { WebhookEnvelope } from "../src/webhooks/routes.ts";
import { StoreSink } from "../src/webhooks/store-sink.ts";
import { MemoryStore } from "./support/fakes.ts";

const log = pino({ level: "silent" });
const DAY = 24 * 60 * 60 * 1000;

async function seed(store: MemoryStore, count: number) {
  await store.insert(
    Array.from({ length: count }, (_, i) => ({
      mid: `m${i}`,
      accountId: "A",
      senderId: "S",
      sentAt: new Date(),
      text: "hi",
      attachments: [],
      raw: {},
    })),
  );
}

describe("MessageWorker", () => {
  it("processes every due message, never more than `concurrency` at once, and stops cleanly", async () => {
    const store = new MemoryStore(() => new Date());
    await seed(store, 7);

    let running = 0;
    let peak = 0;
    const processed: string[] = [];
    const worker = new MessageWorker({
      store,
      log,
      concurrency: 3,
      idleMs: 5,
      process: async (message: StoredMessage) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        processed.push(message.mid);
        await store.settle(message.mid, { status: "replied" });
        running -= 1;
      },
    });

    worker.start();
    await expect.poll(() => processed.length, { timeout: 2_000 }).toBe(7);
    await worker.stop();

    expect(new Set(processed).size).toBe(7);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("keeps running when a step crashes, leaving the message to its lapsed claim", async () => {
    const store = new MemoryStore(() => new Date());
    await seed(store, 2);
    const seen: string[] = [];
    const worker = new MessageWorker({
      store,
      log,
      idleMs: 5,
      process: async (message) => {
        seen.push(message.mid);
        if (message.mid === "m0") throw new Error("settle failed");
        await store.settle(message.mid, { status: "replied" });
      },
    });

    worker.start();
    await expect.poll(() => seen.includes("m1"), { timeout: 2_000 }).toBe(true);
    await worker.stop();
    expect(store.row("m0").status).toBe("received");
    expect(store.row("m0").lockedUntil).not.toBeNull();
  });
});

describe("StoreSink", () => {
  it("queues only messages addressed to our account", async () => {
    const store = new MemoryStore(() => new Date());
    const sink = new StoreSink({ store, accountId: "17841400000000001", log });
    const fixture = (name: string) =>
      JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as WebhookEnvelope;

    await sink.accept({ rawBody: Buffer.alloc(0), body: fixture("ig-reel-share.json"), receivedAt: new Date() });
    await sink.accept({ rawBody: Buffer.alloc(0), body: fixture("dashboard-test-messages.json"), receivedAt: new Date() });
    // Meta redelivers the same event.
    await sink.accept({ rawBody: Buffer.alloc(0), body: fixture("ig-reel-share.json"), receivedAt: new Date() });

    expect([...store.rows.values()].map((r) => r.senderId)).toEqual(["1234567890123456"]);
  });
});

describe("isRefreshDue", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const ahead = (ms: number) => new Date(now.getTime() + ms);

  it("waits until the token is a day old, as Meta requires", () => {
    expect(isRefreshDue({ issuedAt: ago(DAY / 2), expiresAt: null }, now)).toBe(false);
  });

  it("refreshes a seeded token of unknown expiry once it may", () => {
    expect(isRefreshDue({ issuedAt: ago(2 * DAY), expiresAt: null }, now)).toBe(true);
  });

  it("refreshes only within the last 30 days of validity", () => {
    expect(isRefreshDue({ issuedAt: ago(10 * DAY), expiresAt: ahead(50 * DAY) }, now)).toBe(false);
    expect(isRefreshDue({ issuedAt: ago(31 * DAY), expiresAt: ahead(29 * DAY) }, now)).toBe(true);
  });
});
