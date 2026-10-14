import { pino } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import type { InboundMessage } from "../src/conversation/events.ts";
import { MessageProcessor } from "../src/conversation/processor.ts";
import { GraphApiError } from "../src/meta/graph-client.ts";
import { StashhApiError, type Place, type Recognition } from "../src/stashh/client.ts";
import { clock, FakeMessenger, FakeStashh, MemoryStore } from "./support/fakes.ts";

const SENDER = "igsid-1";
const REEL_URL = "https://www.instagram.com/reel/Dd31ojZOgKL/";
const RECOGNITION_ID = "00000000-0000-4000-8000-0000000000aa";

const place = (n: number): Place => ({
  google_place_id: `place-${n}`,
  name: `Mekân ${n}`,
  address: "Moda Cd. 4, Kadıköy",
  rating: 4.6,
  thumbnail_url: `https://cdn.example/${n}.jpg`,
  instagram_username: null,
  recommendations: [],
});

const recognition = (status: Recognition["status"], places: Place[] | null = null, error: string | null = null): Recognition => ({
  recognition_id: RECOGNITION_ID,
  status,
  places,
  error_message: error,
});

let time: ReturnType<typeof clock>;
let store: MemoryStore;
let stashh: FakeStashh;
let messenger: FakeMessenger;
let processor: MessageProcessor;
let seq = 0;

beforeEach(() => {
  time = clock();
  store = new MemoryStore(time.now);
  stashh = new FakeStashh();
  messenger = new FakeMessenger();
  processor = new MessageProcessor({ store, stashh, messenger, log: pino({ level: "silent" }), now: time.now });
});

async function deliver(message: Partial<Pick<InboundMessage, "text" | "attachments" | "sentAt">>): Promise<string> {
  const mid = `mid-${++seq}`;
  await store.insert([
    {
      mid,
      accountId: "17841429946098008",
      senderId: SENDER,
      sentAt: message.sentAt ?? time.now(),
      text: message.text ?? null,
      attachments: message.attachments ?? [],
      raw: {},
    },
  ]);
  return mid;
}

const reel = () => deliver({ attachments: [{ type: "ig_reel", payload: { url: REEL_URL, title: "caption" } }] });

/** Claims and processes everything currently due, like one worker tick. */
async function tick(): Promise<void> {
  for (const message of await store.claim(10, 60)) await processor.process(message);
}

/** Moves the clock to the row's next attempt and runs it. */
async function next(mid: string): Promise<void> {
  const due = store.row(mid).nextAttemptAt.getTime() - time.now().getTime();
  if (due > 0) time.advance(due);
  await tick();
}

describe("recognizing a shared Reel", () => {
  it("submits once, polls until done, and replies with a summary and a carousel", async () => {
    const mid = await reel();
    await tick();

    expect(messenger.typed).toEqual([SENDER]);
    expect(stashh.created).toEqual([
      { userId: "00000000-0000-4000-8000-000000000001", source: { kind: "url", url: REEL_URL }, idempotencyKey: mid },
    ]);
    expect(store.row(mid)).toMatchObject({ status: "submitted", recognitionId: RECOGNITION_ID, lockedUntil: null });

    stashh.getSteps.push(recognition("processing"));
    await next(mid);
    expect(store.row(mid).status).toBe("submitted");
    expect(messenger.sent).toHaveLength(0);

    stashh.getSteps.push(recognition("completed", [place(1), place(2)]));
    await next(mid);

    expect(store.row(mid)).toMatchObject({ status: "replied", repliesSent: 2, intent: "recognize", finishedAt: time.now() });
    expect(messenger.texts()).toEqual(["Bu Reel'de 2 mekân var."]);
    const carousel = messenger.sent[1]?.message;
    expect(carousel?.kind).toBe("carousel");
    if (carousel?.kind === "carousel") {
      expect(carousel.cards.map((c) => c.title)).toEqual(["Mekân 1", "Mekân 2"]);
      expect(carousel.cards[0]?.subtitle).toBe("★ 4,6 · Moda Cd. 4, Kadıköy");
    }
  });

  it("says so when the Reel has no places", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", []));
    await next(mid);

    expect(store.row(mid).status).toBe("replied");
    expect(messenger.texts()).toEqual(["Bu Reel'de bir mekân bulamadık. Başka bir Reel gönder, içindekileri çıkaralım."]);
  });

  it("apologises when the recognition fails", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("failed", null, "video unavailable"));
    await next(mid);

    expect(store.row(mid)).toMatchObject({ status: "failed", lastError: "video unavailable" });
    expect(messenger.texts()).toEqual(["Bu Reel'i şu an okuyamadık. Birazdan tekrar gönderir misin?"]);
  });

  it("gives up with an apology when the recognition never finishes", async () => {
    const mid = await reel();
    await tick();
    for (let i = 0; i < 100 && store.row(mid).status === "submitted"; i++) {
      stashh.getSteps.push(recognition("processing"));
      await next(mid);
    }

    expect(store.row(mid).status).toBe("failed");
    expect(store.row(mid).lastError).toMatch(/timed out/);
    expect(messenger.texts()).toEqual(["Bu Reel'i şu an okuyamadık. Birazdan tekrar gönderir misin?"]);
  });

  it("recognizes a pasted TikTok link and names it as a video", async () => {
    const mid = await deliver({ text: "bak https://www.tiktok.com/@someone/video/123 buraya" });
    await tick();
    expect(stashh.created[0]?.source).toEqual({ kind: "url", url: "https://www.tiktok.com/@someone/video/123" });

    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);
    expect(messenger.texts()).toEqual(["Bu videoda 1 mekân var."]);
  });

  it("recognizes a shared feed post from its media and names it as a post", async () => {
    const mid = await deliver({
      attachments: [
        { type: "ig_post", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=7", title: "liste", ig_post_media_id: "7" } },
      ],
    });
    await tick();
    expect(stashh.created[0]?.source).toEqual({
      kind: "instagram_media",
      mediaId: "7",
      mediaUrl: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=7",
      caption: "liste",
    });

    stashh.getSteps.push(recognition("completed", [place(1), place(2)]));
    await next(mid);
    expect(messenger.texts()).toEqual(["Bu gönderide 2 mekân var."]);
  });

  it("splits more than ten places into several carousels", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", Array.from({ length: 12 }, (_, i) => place(i))));
    await next(mid);

    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["text", "carousel", "carousel"]);
    expect(store.row(mid).repliesSent).toBe(3);
  });
});

describe("failures and retries", () => {
  it("backs off on a retryable error and succeeds on a later attempt", async () => {
    stashh.createSteps.push(new StashhApiError(503, null, "unavailable"));
    const mid = await reel();
    await tick();

    const row = store.row(mid);
    expect(row).toMatchObject({ status: "received", attempts: 1, lastError: "unavailable", lockedUntil: null, finishedAt: null });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(time.now().getTime());

    await next(mid);
    expect(store.row(mid).status).toBe("submitted");
    expect(stashh.created).toHaveLength(1);
  });

  it("fails with an apology after too many retryable errors", async () => {
    const mid = await reel();
    for (let i = 0; i < 20 && store.row(mid).status === "received"; i++) {
      stashh.createSteps.push(new StashhApiError(500, null, "boom"));
      await next(mid);
    }

    expect(store.row(mid).status).toBe("failed");
    expect(store.row(mid).attempts).toBeGreaterThan(1);
    expect(messenger.texts()).toEqual(["Bu Reel'i şu an okuyamadık. Birazdan tekrar gönderir misin?"]);
  });

  it("fails at once with an apology on a permanent error", async () => {
    stashh.createSteps.push(new StashhApiError(400, "VALIDATION_ERROR", "bad url"));
    const mid = await reel();
    await tick();

    expect(store.row(mid)).toMatchObject({ status: "failed", attempts: 1, lastError: "bad url" });
    expect(messenger.texts()).toHaveLength(1);
  });

  it("does not try to apologise when Instagram itself refuses the reply", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", [place(1)]));
    messenger.sendSteps.push(new GraphApiError(400, 10, "outside of allowed window"));
    await next(mid);

    expect(store.row(mid).status).toBe("failed");
    expect(messenger.sent).toHaveLength(0);
  });

  it("resumes a half-sent reply without repeating what was delivered", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", [place(1)]));
    messenger.sendSteps.push(undefined, new GraphApiError(500, 2, "temporarily unavailable"));
    await next(mid);

    expect(store.row(mid)).toMatchObject({ status: "submitted", repliesSent: 1, attempts: 1 });
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["text"]);

    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);
    expect(store.row(mid).status).toBe("replied");
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["text", "carousel"]);
  });

  it("expires a message older than the 24-hour reply window without replying", async () => {
    const mid = await reel();
    time.advance(25 * 60 * 60 * 1000);
    await tick();

    expect(store.row(mid)).toMatchObject({ status: "expired", intent: "recognize", finishedAt: time.now() });
    expect(messenger.sent).toHaveLength(0);
    expect(stashh.created).toHaveLength(0);
  });
});

describe("other intents", () => {
  it("erases the sender's data, confirms, and forgets their messages", async () => {
    const older = await deliver({ text: "merhaba" });
    await tick();
    const mid = await deliver({ text: "Sil" });
    await tick();

    expect(stashh.erased).toEqual([SENDER]);
    expect(messenger.texts().at(-1)).toBe("Stashh'teki verilerini sildik.");
    expect(store.rows.has(mid)).toBe(false);
    expect(store.rows.has(older)).toBe(false);
  });

  it("explains what Stashh does for an ordinary message", async () => {
    const mid = await deliver({ text: "merhaba" });
    await tick();
    expect(store.row(mid)).toMatchObject({ status: "replied", intent: "help" });
    expect(store.row(mid).finishedAt).not.toBeNull();
    expect(messenger.texts()).toEqual(['Bir Reel ya da gönderi paylaş, içindeki mekânları sana listeleyelim. Verilerini silmek için "sil" yaz.']);
  });

  it("says which shares it can read for an unsupported attachment", async () => {
    const mid = await deliver({ attachments: [{ type: "story_mention", payload: { url: "https://lookaside.example/x" } }] });
    await tick();
    expect(store.row(mid).status).toBe("replied");
    expect(messenger.texts()[0]).toMatch(/^Şimdilik Reel'leri, gönderileri/);
  });

  it("ignores a redelivered message id", async () => {
    await reel();
    const stored = await store.insert([...store.rows.values()].map((r) => ({ ...r, raw: {} })));
    expect(stored).toBe(0);
  });
});
