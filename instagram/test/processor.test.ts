import { pino } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import type { InboundMessage } from "../src/conversation/events.ts";
import { CHAT_DEBOUNCE_MS, MessageProcessor } from "../src/conversation/processor.ts";
import { GraphApiError } from "../src/meta/graph-client.ts";
import { copy } from "../src/replies/copy.tr.ts";
import { StashhApiError, type Place, type Recognition } from "../src/stashh/client.ts";
import { clock, FakeAnalytics, FakeMessenger, FakeProfiles, FakeStashh, MemoryStore } from "./support/fakes.ts";

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

const recognition = (
  status: Recognition["status"],
  places: Place[] | null = null,
  error: string | null = null,
  code: Recognition["error_code"] = null,
): Recognition => ({
  recognition_id: RECOGNITION_ID,
  status,
  places,
  names_elsewhere: false,
  error_message: error,
  error_code: code,
});

let time: ReturnType<typeof clock>;
let store: MemoryStore;
let stashh: FakeStashh;
let messenger: FakeMessenger;
let profiles: FakeProfiles;
let analytics: FakeAnalytics;
let processor: MessageProcessor;
let seq = 0;

beforeEach(() => {
  time = clock();
  store = new MemoryStore(time.now);
  stashh = new FakeStashh();
  messenger = new FakeMessenger();
  profiles = new FakeProfiles();
  analytics = new FakeAnalytics();
  processor = new MessageProcessor({ store, stashh, messenger, profiles, analytics, log: pino({ level: "silent" }), now: time.now });
});

async function deliver(message: Partial<Pick<InboundMessage, "text" | "attachments" | "sentAt" | "tapped">>): Promise<string> {
  const mid = `mid-${++seq}`;
  await store.insert([
    {
      mid,
      accountId: "17841429946098008",
      senderId: SENDER,
      sentAt: message.sentAt ?? time.now(),
      text: message.text ?? null,
      attachments: message.attachments ?? [],
      tapped: message.tapped ?? null,
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

describe("naming the sender", () => {
  it("hands the sender's Instagram profile to the backend with the user", async () => {
    profiles.answers.set(SENDER, { username: "ayse.k", name: "Ayşe" });
    await reel();
    await tick();

    expect(stashh.resolvedProfiles).toEqual([{ username: "ayse.k", name: "Ayşe" }]);
  });

  it("still recognizes when the profile cannot be read", async () => {
    profiles.answers.set(SENDER, new GraphApiError(400, 100, "Unsupported get request"));
    const mid = await reel();
    await tick();

    expect(stashh.resolvedProfiles).toEqual([null]);
    expect(store.row(mid).status).toBe("submitted");
  });
});

describe("recognizing a shared Reel", () => {
  it("submits once, polls until done, and replies with a summary and a carousel", async () => {
    const mid = await reel();
    await tick();

    expect(messenger.typed).toEqual([SENDER]);
    expect(stashh.created).toEqual([
      { userId: "00000000-0000-4000-8000-000000000001", source: { kind: "url", url: REEL_URL, caption: "caption" }, idempotencyKey: mid },
    ]);
    expect(store.row(mid)).toMatchObject({ status: "submitted", recognitionId: RECOGNITION_ID, lockedUntil: null });

    stashh.getSteps.push(recognition("processing"));
    await next(mid);
    expect(store.row(mid).status).toBe("submitted");
    expect(messenger.sent).toHaveLength(0);

    stashh.getSteps.push(recognition("completed", [place(1), place(2)]));
    await next(mid);

    expect(store.row(mid)).toMatchObject({ status: "replied", repliesSent: 2, intent: "recognize", finishedAt: time.now() });
    expect(messenger.texts()).toEqual(["Bu Reel'de 2 mekân var, hepsini haritana ekledik."]);
    expect(stashh.minted).toEqual(["00000000-0000-4000-8000-000000000001"]);
    expect(messenger.buttons()).toEqual([{ title: "Haritanda aç", url: `https://stashh.me/app/a/${"c".repeat(31)}0` }]);
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "button"]);
    expect(messenger.quickReplies().at(-1)).toEqual([]);
    const carousel = messenger.sent[0]?.message;
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
    expect(messenger.texts()).toEqual(["Bu Reel'i okurken bir sorun çıktı. Birazdan tekrar gönderir misin?"]);
  });

  it("says the post is private when the backend says so", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("failed", null, "Instagram returned a login page", "private"));
    await next(mid);

    expect(messenger.texts()).toEqual([
      "Bu Reel gizli bir hesaptan, açamadık. Herkese açık bir Reel gönderirsen içindeki mekânları çıkarırız.",
    ]);
  });

  it("asks to send it again later when Instagram withheld the media", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("failed", null, "Downloader: throttled: 28 blank items", "temporarily_unavailable"));
    await next(mid);

    expect(store.row(mid)).toMatchObject({ status: "failed", lastError: "Downloader: throttled: 28 blank items" });
    expect(messenger.texts()).toEqual(["Instagram bu Reel'i şu an bize açmıyor. Birkaç dakika sonra tekrar gönderir misin?"]);
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
    expect(messenger.texts()).toEqual(["Bu Reel'i okurken bir sorun çıktı. Birazdan tekrar gönderir misin?"]);
  });

  it("recognizes a pasted TikTok link and names it as a video", async () => {
    const mid = await deliver({ text: "bak https://www.tiktok.com/@someone/video/123 buraya" });
    await tick();
    expect(stashh.created[0]?.source).toEqual({ kind: "url", url: "https://www.tiktok.com/@someone/video/123" });

    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);
    expect(messenger.texts()).toEqual(["Bu videoda 1 mekân var, hepsini haritana ekledik."]);
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
      format: "post",
      mediaId: "7",
      mediaUrl: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=7",
      caption: "liste",
    });

    stashh.getSteps.push(recognition("completed", [place(1), place(2)]));
    await next(mid);
    expect(messenger.texts()).toEqual(["Bu gönderide 2 mekân var, hepsini haritana ekledik."]);
  });

  it("asks for the post's link when the shared page shows a venue but not its name", async () => {
    const mid = await deliver({
      attachments: [
        { type: "ig_post", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=8", title: "15 mekan önerisi", ig_post_media_id: "8" } },
      ],
    });
    await tick();
    stashh.getSteps.push({ ...recognition("completed", []), names_elsewhere: true });
    await next(mid);
    expect(store.row(mid).status).toBe("replied");
    expect(messenger.texts()).toEqual([
      "Instagram paylaşılan gönderinin bize yalnızca bir sayfasını gösteriyor ve o sayfada mekânın adı yok. Gönderinin linkini atarsan tüm sayfalarını okuyalım: gönderide Paylaş, sonra Bağlantıyı kopyala.",
    ]);
  });

  it("saves what the shared page named and asks for the link to read the other pages", async () => {
    const mid = await deliver({
      attachments: [
        { type: "ig_post", payload: { url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=9", title: "1 günlük rota", ig_post_media_id: "9" } },
      ],
    });
    await tick();
    stashh.getSteps.push({ ...recognition("completed", [place(1)]), names_elsewhere: true });
    await next(mid);

    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "button"]);
    expect(messenger.texts()).toEqual([
      "Bu gönderide 1 mekân bulduk, haritana ekledik. Instagram paylaşılan gönderinin bize yalnızca bir sayfasını gösteriyor, diğer mekânlar kalan sayfalarda olabilir. Gönderinin linkini atarsan tüm sayfalarını okuyalım: gönderide Paylaş, sonra Bağlantıyı kopyala.",
    ]);
    expect(analytics.of("recognition_completed")[0]?.props).toMatchObject({ place_count: 1, source_type: "post" });
  });

  it("keeps the plain summary for a link that also says names are elsewhere: the link was read whole", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push({ ...recognition("completed", [place(1)]), names_elsewhere: true });
    await next(mid);
    expect(messenger.texts()).toEqual(["Bu Reel'de 1 mekân var, hepsini haritana ekledik."]);
  });

  it("keeps the plain empty reply for a link whose post names nothing", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push({ ...recognition("completed", []), names_elsewhere: true });
    await next(mid);
    expect(messenger.texts()).toEqual(["Bu Reel'de bir mekân bulamadık. Başka bir Reel gönder, içindekileri çıkaralım."]);
  });

  it("splits more than ten places into several carousels", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", Array.from({ length: 12 }, (_, i) => place(i))));
    await next(mid);

    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "carousel", "button"]);
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
    expect(messenger.texts()).toEqual(["Bu Reel'i okurken bir sorun çıktı. Birazdan tekrar gönderir misin?"]);
  });

  it("fails at once with an apology on a permanent error", async () => {
    stashh.createSteps.push(new StashhApiError(400, "VALIDATION_ERROR", "bad url"));
    const mid = await reel();
    await tick();

    expect(store.row(mid)).toMatchObject({ status: "failed", attempts: 1, lastError: "bad url" });
    expect(messenger.texts()).toHaveLength(1);
  });

  it("says the day's limit is reached, once, without retrying, when the backend refuses with RECOGNITION_QUOTA", async () => {
    stashh.createSteps.push(new StashhApiError(429, "RECOGNITION_QUOTA", "Daily recognition limit reached"));
    const mid = await reel();
    await tick();

    expect(store.row(mid)).toMatchObject({ status: "failed", lastError: "daily recognition cap reached" });
    expect(messenger.texts()).toEqual([copy.dailyLimit]);
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
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel"]);

    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);
    expect(store.row(mid).status).toBe("replied");
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "button"]);
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

  it("explains what Stashh does for an empty message", async () => {
    const mid = await deliver({ text: "   " });
    await tick();
    expect(store.row(mid)).toMatchObject({ status: "replied", intent: "help" });
    expect(messenger.texts()[0]).toContain("arkadaşına atar gibi bana at");
  });

  it("sends a fresh personal link to the map for \"harita\"", async () => {
    const mid = await deliver({ text: "Harita" });
    await tick();

    expect(stashh.resolved).toEqual([SENDER]);
    expect(stashh.minted).toEqual(["00000000-0000-4000-8000-000000000001"]);
    expect(store.row(mid)).toMatchObject({ status: "replied", intent: "link" });
    expect(messenger.sent).toEqual([
      {
        to: SENDER,
        message: {
          kind: "button",
          text: "Kaydettiğin mekânlar haritanda. Bu link sadece sana özel, yedi gün içinde bir kez açılır.",
          buttons: [{ type: "web_url", title: "Haritanda aç", url: `https://stashh.me/app/a/${"c".repeat(31)}0` }],
        },
      },
    ]);
  });

  it("retries the link when the backend cannot mint one", async () => {
    stashh.mintSteps.push(new StashhApiError(503, null, "unavailable"));
    const mid = await deliver({ text: "link" });
    await tick();
    expect(store.row(mid)).toMatchObject({ status: "received", attempts: 1 });

    await next(mid);
    expect(store.row(mid).status).toBe("replied");
    expect(messenger.buttons()).toHaveLength(1);
  });

  it("still replies with the places when the map link cannot be minted", async () => {
    const mid = await reel();
    await tick();
    stashh.mintSteps.push(new StashhApiError(500, null, "boom"));
    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);

    expect(store.row(mid).status).toBe("replied");
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "text"]);
    expect(messenger.texts()).toEqual(["Bu Reel'de 1 mekân var, hepsini haritana ekledik."]);
  });

  it("sends no map link when nothing was found", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", []));
    await next(mid);
    expect(stashh.minted).toEqual([]);
  });

  it("says which shares it can read for an unsupported attachment", async () => {
    const mid = await deliver({ attachments: [{ type: "story_mention", payload: { url: "https://lookaside.example/x" } }] });
    await tick();
    expect(store.row(mid).status).toBe("replied");
    expect(messenger.texts()[0]).toMatch(/^Bunu okuyamıyorum/);
  });

  it("recognizes a shared story and names it as one in the reply", async () => {
    const STORY_URL = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18094747109404940&signature=x";
    const mid = await deliver({ attachments: [{ type: "ig_story", payload: { story_media_id: "18094747109404940", story_media_url: STORY_URL } }] });
    await tick();
    expect(stashh.created[0]?.source).toEqual({ kind: "instagram_media", format: "story", mediaId: "18094747109404940", mediaUrl: STORY_URL, caption: null });

    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);
    expect(store.row(mid)).toMatchObject({ status: "replied", intent: "recognize" });
    expect(messenger.texts()).toEqual(["Bu hikâyede 1 mekân var, hepsini haritana ekledik."]);
  });

  it("ignores a redelivered message id", async () => {
    await reel();
    const stored = await store.insert([...store.rows.values()].map((r) => ({ ...r, raw: {} })));
    expect(stored).toBe(0);
  });
});

describe("talking to the assistant", () => {
  /** Lets the chat debounce pass, then runs one tick. */
  async function settleChat(): Promise<void> {
    time.advance(CHAT_DEBOUNCE_MS);
    await tick();
  }

  it("waits for follow-ups, then asks the assistant once and sends its plan", async () => {
    profiles.answers.set(SENDER, { username: "ayse.k", name: "Ayşe" });
    const mid = await deliver({ text: "listelerim neler" });
    await tick();
    expect(store.row(mid)).toMatchObject({ status: "received", intent: "chat", lockedUntil: null });
    expect(stashh.turns).toEqual([]);
    // Already seen and typing while the follow-up wait runs.
    expect(messenger.actions.map((a) => a.action)).toEqual(["mark_seen", "typing_on"]);

    stashh.turnSteps.push({
      messages: [
        { kind: "carousel", cards: [{ title: "🌊 İzmir", subtitle: "7 mekân", buttons: [{ type: "postback", title: "Mekânları gör", payload: "SHOW_LIST:l1" }] }] },
        { kind: "text", text: "İki listen var.", quick_replies: [{ title: "Haritamı aç", payload: "OPEN_MAP" }] },
      ],
    });
    await settleChat();

    expect(messenger.typed).toEqual([SENDER, SENDER]);
    expect(stashh.resolvedProfiles).toEqual([{ username: "ayse.k", name: "Ayşe" }]);
    expect(stashh.turns).toEqual([{ userId: "00000000-0000-4000-8000-000000000001", messages: [{ externalId: mid, text: "listelerim neler", tapped: null }] }]);
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "text"]);
    expect(messenger.quickReplies()).toEqual([[], [{ title: "Haritamı aç", payload: "OPEN_MAP" }]]);
    expect(store.row(mid)).toMatchObject({ status: "replied", intent: "chat", repliesSent: 2 });
  });

  it("folds quick follow-ups of the same sender into one turn, oldest first", async () => {
    const first = await deliver({ text: "selam" });
    time.advance(1_000);
    const second = await deliver({ text: "listelerim neler" });
    time.advance(500);
    const third = await deliver({ text: "bir de haritamı aç" });
    await tick();
    expect(stashh.turns).toEqual([]);

    await settleChat();
    expect(stashh.turns).toHaveLength(1);
    expect(stashh.turns[0]!.messages.map((m) => [m.externalId, m.text])).toEqual([
      [first, "selam"],
      [second, "listelerim neler"],
      [third, "bir de haritamı aç"],
    ]);
    expect(messenger.texts()).toEqual(["assistant: selam | listelerim neler | bir de haritamı aç"]);
    // One row carried the reply; the others were folded into it.
    const rows = [first, second, third].map((mid) => store.row(mid));
    expect(rows.every((row) => row.status === "replied" && row.intent === "chat")).toBe(true);
    const carrier = rows.filter((row) => row.repliesSent === 1);
    expect(carrier).toHaveLength(1);
    for (const row of rows) if (row !== carrier[0]) expect(row).toMatchObject({ repliesSent: 0, lastError: `folded into ${carrier[0]!.mid}` });
  });

  it("leaves a share of the same sender to run on its own after the turn", async () => {
    const chat = await deliver({ text: "merhaba" });
    time.advance(100);
    const share = await reel();
    await settleChat();

    expect(stashh.turns[0]!.messages.map((m) => m.externalId)).toEqual([chat]);
    expect(store.row(share)).toMatchObject({ status: "received", lockedUntil: null });
    await tick();
    expect(store.row(share).status).toBe("submitted");
  });

  it("hands a tap to the assistant with its payload", async () => {
    const mid = await deliver({ text: "Listeye koy", tapped: { title: "Listeye koy", payload: `ADD_TO_LIST:${RECOGNITION_ID}` } });
    await settleChat();
    expect(stashh.turns[0]!.messages).toEqual([{ externalId: mid, text: "Listeye koy", tapped: { title: "Listeye koy", payload: `ADD_TO_LIST:${RECOGNITION_ID}` } }]);
  });

  it("erases on the confirming tap without asking the assistant", async () => {
    const mid = await deliver({ text: "Evet, sil", tapped: { title: "Evet, sil", payload: "ERASE_CONFIRM" } });
    await tick();
    expect(stashh.erased).toEqual([SENDER]);
    expect(stashh.turns).toEqual([]);
    expect(store.rows.has(mid)).toBe(false);
  });

  it("works on one sender's messages one at a time, in order", async () => {
    const a = await deliver({ text: "bir" });
    time.advance(CHAT_DEBOUNCE_MS + 100);
    const claimed = await store.claim(10, 60);
    expect(claimed.map((m) => m.mid)).toEqual([a]);
    const b = await deliver({ text: "iki" });
    time.advance(CHAT_DEBOUNCE_MS + 100);
    // `a` is still leased, so `b` waits even though it is due.
    expect((await store.claim(10, 60)).map((m) => m.mid)).toEqual([]);
    await store.settle(a, { status: "replied" });
    expect((await store.claim(10, 60)).map((m) => m.mid)).toEqual([b]);
  });

  it("retries a failed turn a little, then apologises in the assistant's words", async () => {
    const mid = await deliver({ text: "merhaba" });
    stashh.turnSteps.push(new StashhApiError(503, null, "down"), new StashhApiError(503, null, "down"), new StashhApiError(503, null, "down"));
    await settleChat();
    expect(store.row(mid)).toMatchObject({ status: "received", attempts: 1 });
    await next(mid);
    expect(store.row(mid)).toMatchObject({ status: "received", attempts: 2 });
    await next(mid);
    expect(store.row(mid)).toMatchObject({ status: "failed", attempts: 3 });
    expect(messenger.texts()).toEqual(["Şu an cevap veremiyorum, birazdan tekrar yazar mısın?"]);
  });

  it("resumes a half-sent plan without repeating what was delivered", async () => {
    const mid = await deliver({ text: "merhaba" });
    stashh.turnSteps.push({ messages: [{ kind: "carousel", cards: [{ title: "A", buttons: [] }] }, { kind: "text", text: "Son." }] });
    messenger.sendSteps.push(undefined, new GraphApiError(500, 2, "temporarily unavailable"));
    await settleChat();
    expect(store.row(mid)).toMatchObject({ status: "received", repliesSent: 1, attempts: 1 });

    // The backend replays the same plan for the same message.
    stashh.turnSteps.push({ messages: [{ kind: "carousel", cards: [{ title: "A", buttons: [] }] }, { kind: "text", text: "Son." }] });
    await next(mid);
    expect(messenger.sent.map((s) => s.message.kind)).toEqual(["carousel", "text"]);
    expect(store.row(mid).status).toBe("replied");
  });
});

describe("product analytics", () => {
  const USER = "00000000-0000-4000-8000-000000000001";
  const sharedPost = (mediaId: string) =>
    deliver({ attachments: [{ type: "ig_post", payload: { url: `https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=${mediaId}`, title: "liste", ig_post_media_id: mediaId } }] });

  /** Runs a shared Reel to the given recognition result. */
  async function reelEndingWith(result: Recognition): Promise<string> {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(result);
    await next(mid);
    return mid;
  }

  it("follows a shared Reel from the share to the places, on the sender's user", async () => {
    const sentAt = time.now();
    const mid = await reel();
    await tick();
    expect(analytics.names()).toEqual(["user_signed_up", "recognition_started"]);
    expect(analytics.of("recognition_started")[0]).toMatchObject({
      props: { entry: "dm_share", source_type: "reel" },
      userId: USER,
      time: sentAt,
      key: mid,
    });

    stashh.getSteps.push(recognition("processing"));
    await next(mid);
    stashh.getSteps.push(recognition("completed", [place(1), place(2)]));
    time.advance(1_000);
    await next(mid);

    expect(analytics.names()).toEqual(["user_signed_up", "recognition_started", "recognition_completed"]);
    const [completed] = analytics.of("recognition_completed");
    expect(completed).toMatchObject({ props: { entry: "dm_share", source_type: "reel", place_count: 2 }, userId: USER, key: mid, time: time.now() });
    expect(completed?.props.duration_ms).toBe(time.now().getTime() - sentAt.getTime());
    // Reported once the places were delivered and the message settled.
    expect(store.row(mid).status).toBe("replied");
  });

  it("names a pasted TikTok link as a link to a TikTok", async () => {
    const mid = await deliver({ text: "bak https://www.tiktok.com/@someone/video/123" });
    await tick();
    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);

    for (const name of ["recognition_started", "recognition_completed"] as const) {
      expect(analytics.of(name)[0]?.props).toMatchObject({ entry: "dm_link", source_type: "tiktok" });
    }
  });

  it("names a shared feed post and a shared story by what they are", async () => {
    await sharedPost("7");
    await tick();
    const STORY_URL = "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18094747109404940&signature=x";
    await deliver({ attachments: [{ type: "ig_story", payload: { story_media_id: "18094747109404940", story_media_url: STORY_URL } }] });
    await tick();

    expect(analytics.of("recognition_started").map((e) => e.props)).toEqual([
      { entry: "dm_share", source_type: "post" },
      { entry: "dm_share", source_type: "story" },
    ]);
  });

  it.each([
    ["no_places", recognition("completed", [])],
    ["private", recognition("failed", null, "login page", "private")],
    ["unavailable", recognition("failed", null, "throttled", "temporarily_unavailable")],
    ["unreadable", recognition("failed", null, "parse error", "unreadable")],
    ["error", recognition("cancelled")],
  ])("reports %s when the reply carries no places", async (reason, result) => {
    const mid = await reelEndingWith(result);

    expect(analytics.names().filter((n) => n.startsWith("recognition_"))).toEqual(["recognition_started", "recognition_failed"]);
    expect(analytics.of("recognition_failed")[0]).toMatchObject({ props: { reason, entry: "dm_share", source_type: "reel" }, key: mid });
  });

  it("reports needs_link when a shared post shows a venue but none of its names", async () => {
    const mid = await sharedPost("8");
    await tick();
    stashh.getSteps.push({ ...recognition("completed", []), names_elsewhere: true });
    await next(mid);

    expect(analytics.of("recognition_failed")[0]?.props).toMatchObject({ reason: "needs_link", source_type: "post" });
  });

  it("reports timed_out when the recognition never finishes", async () => {
    const mid = await reel();
    await tick();
    for (let i = 0; i < 100 && store.row(mid).status === "submitted"; i++) {
      stashh.getSteps.push(recognition("processing"));
      await next(mid);
    }

    expect(analytics.names().filter((n) => n.startsWith("recognition_"))).toEqual(["recognition_started", "recognition_failed"]);
    expect(analytics.of("recognition_failed")[0]?.props.reason).toBe("timed_out");
  });

  it("reports daily_limit, paired with its start, when the backend refuses with RECOGNITION_QUOTA", async () => {
    stashh.createSteps.push(new StashhApiError(429, "RECOGNITION_QUOTA", "Daily recognition limit reached"));
    await reel();
    await tick();

    expect(analytics.names()).toEqual(["user_signed_up", "recognition_started", "recognition_failed"]);
    expect(analytics.of("recognition_failed")[0]?.props.reason).toBe("daily_limit");
  });

  it("repeats the start of a retried share at the same moment and key, so Mixpanel keeps one", async () => {
    stashh.createSteps.push(new StashhApiError(503, null, "unavailable"));
    const mid = await reel();
    await tick();
    await next(mid);

    const started = analytics.of("recognition_started");
    expect(started).toHaveLength(2);
    expect(started[1]).toEqual(started[0]);
    expect(analytics.of("recognition_failed")).toHaveLength(0);
  });

  it("reports error once a share fails for good on our side", async () => {
    stashh.createSteps.push(new StashhApiError(400, "VALIDATION_ERROR", "bad url"));
    const mid = await reel();
    await tick();

    expect(store.row(mid).status).toBe("failed");
    expect(analytics.of("recognition_failed").map((e) => e.props.reason)).toEqual(["error"]);
  });

  it("reports one completion for a reply that was half sent and then resumed", async () => {
    const mid = await reel();
    await tick();
    stashh.getSteps.push(recognition("completed", [place(1)]));
    messenger.sendSteps.push(undefined, new GraphApiError(500, 2, "temporarily unavailable"));
    await next(mid);
    expect(analytics.of("recognition_completed")).toHaveLength(0);

    stashh.getSteps.push(recognition("completed", [place(1)]));
    await next(mid);
    expect(analytics.of("recognition_completed")).toHaveLength(1);
  });

  it("reports timed_out for a submitted share whose reply window closed", async () => {
    const mid = await reel();
    await tick();
    time.advance(25 * 60 * 60 * 1000);
    await tick();

    expect(store.row(mid).status).toBe("expired");
    expect(analytics.of("recognition_failed")[0]?.props.reason).toBe("timed_out");
  });

  it("sends nothing about a share that expired before it was taken in", async () => {
    await reel();
    time.advance(25 * 60 * 60 * 1000);
    await tick();

    expect(analytics.events).toEqual([]);
  });

  it("sends no recognition events for chat, links, help or unreadable shares", async () => {
    await deliver({ text: "harita" });
    await deliver({ text: "" });
    await deliver({ attachments: [{ type: "story_mention", payload: { url: "https://lookaside.example/x" } }] });
    await tick();
    await deliver({ text: "listelerim neler" });
    time.advance(CHAT_DEBOUNCE_MS);
    await tick();

    expect(analytics.names()).toEqual(["user_signed_up"]);
  });

  it("signs a sender up once, naming the profile with what Instagram gave", async () => {
    profiles.answers.set(SENDER, { username: "ayse.k", name: "Ayşe" });
    await reel();
    await tick();
    await reel();
    await tick();

    expect(analytics.of("user_signed_up")).toEqual([{ name: "user_signed_up", props: {}, userId: USER, time: time.now(), key: USER }]);
    expect(analytics.profiles).toEqual([{ userId: USER, profile: { name: "Ayşe", instagramUsername: "ayse.k", createdAt: time.now() } }]);
  });

  it("deletes the analytics profile when the sender erases their data", async () => {
    await reel();
    await tick();
    await deliver({ text: "sil" });
    await tick();

    expect(analytics.deleted).toEqual([USER]);
  });
});
