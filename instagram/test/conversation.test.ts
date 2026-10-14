import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractInboundMessages } from "../src/conversation/events.ts";
import { interpret } from "../src/conversation/intent.ts";
import type { WebhookEnvelope } from "../src/webhooks/routes.ts";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as WebhookEnvelope;

const envelope = (...messaging: unknown[]): WebhookEnvelope => ({
  object: "instagram",
  entry: [{ id: "ACCOUNT", time: 1, messaging }],
});

const event = (overrides: Record<string, unknown> = {}, message: Record<string, unknown> = {}) => ({
  sender: { id: "PERSON" },
  recipient: { id: "ACCOUNT" },
  timestamp: 1791979565000,
  message: { mid: "m1", text: "hi", ...message },
  ...overrides,
});

describe("extractInboundMessages", () => {
  it("reads a real Reel share", () => {
    const [message, ...rest] = extractInboundMessages(fixture("ig-reel-share.json"));
    expect(rest).toHaveLength(0);
    expect(message).toMatchObject({
      accountId: "17841400000000001",
      senderId: "1234567890123456",
      text: null,
      sentAt: new Date(1791979565000),
      attachments: [{ type: "ig_reel", payload: { url: "https://www.instagram.com/reel/DFixture01A/" } }],
    });
  });

  it("reads the dashboard Test tool's `changes[]` shape with a seconds string timestamp", () => {
    const [message] = extractInboundMessages(fixture("dashboard-test-messages.json"));
    expect(message).toMatchObject({ mid: "random_mid", senderId: "12334", text: "random_text", sentAt: new Date(1527459824 * 1000) });
  });

  it("drops echoes of our own sends, deletions and events without a message", () => {
    const messages = extractInboundMessages(
      envelope(
        event({}, { mid: "echo", is_echo: true }),
        event({ sender: { id: "ACCOUNT" } }, { mid: "own" }),
        event({}, { mid: "deleted", is_deleted: true }),
        { sender: { id: "PERSON" }, recipient: { id: "ACCOUNT" }, timestamp: 1, read: { mid: "x" } },
        event({}, { mid: "kept" }),
      ),
    );
    expect(messages.map((m) => m.mid)).toEqual(["kept"]);
  });

  it("skips a malformed event without losing the rest of the delivery", () => {
    const messages = extractInboundMessages(envelope({ nonsense: true }, event({}, { mid: "kept" })));
    expect(messages.map((m) => m.mid)).toEqual(["kept"]);
  });
});

describe("interpret", () => {
  const reel = (url: string) => ({ text: null, attachments: [{ type: "ig_reel", payload: { url } }] });

  it("recognizes a shared Reel by its permalink", () => {
    expect(interpret(reel("https://www.instagram.com/reel/Dd31ojZOgKL/"))).toEqual({
      kind: "recognize",
      source: { kind: "url", url: "https://www.instagram.com/reel/Dd31ojZOgKL/" },
    });
  });

  it("treats a Reel share without a usable permalink as unsupported", () => {
    expect(interpret(reel("https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1"))).toEqual({
      kind: "unsupported",
      attachmentType: "ig_reel",
    });
  });

  it.each([
    ["https://www.instagram.com/p/C0de123/", "a post"],
    ["https://instagram.com/someone/reel/C0de123", "a Reel under a username"],
    ["https://vm.tiktok.com/ZMabc123/", "a TikTok short link"],
  ])("finds %s in text (%s)", (url) => {
    expect(interpret({ text: `şuna bak ${url} çok iyi`, attachments: [] })).toEqual({ kind: "recognize", source: { kind: "url", url } });
  });

  it.each(["sil", "SİL", " Sil ", "delete"])("reads %j as an erase request", (text) => {
    expect(interpret({ text, attachments: [] })).toEqual({ kind: "erase" });
  });

  it("does not erase on a sentence that merely contains the word", () => {
    expect(interpret({ text: "bunu sil lütfen", attachments: [] })).toEqual({ kind: "help" });
  });

  it("recognizes a shared feed post from the media and caption it carries", () => {
    const [message] = extractInboundMessages(fixture("ig-post-share.json"));
    expect(interpret(message!)).toEqual({
      kind: "recognize",
      source: {
        kind: "instagram_media",
        mediaId: "18000000000000002",
        mediaUrl: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=18000000000000002&signature=FixtureSignature",
        caption: "İstanbul’da jazz kulüpleri listemiz\n\n@fixturejazz 📍 Pera 🍷\n@fixtureclub 📍 Galata 🍸",
      },
    });
  });

  it("treats a shared post without its media id as unsupported", () => {
    expect(interpret({ text: null, attachments: [{ type: "ig_post", payload: { url: "https://lookaside.fbsbx.com/x" } }] })).toEqual({
      kind: "unsupported",
      attachmentType: "ig_post",
    });
  });

  it("does not accept an Instagram story link", () => {
    expect(interpret({ text: "https://www.instagram.com/stories/someone/123/", attachments: [] })).toEqual({ kind: "help" });
  });
});
