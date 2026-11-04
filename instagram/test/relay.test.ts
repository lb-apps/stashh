import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { pino } from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mayMessage, OUTBOUND_BLOCKED, outboundMode } from "../src/conversation/outbound.ts";
import { MessageProcessor } from "../src/conversation/processor.ts";
import { createApp } from "../src/http/app.ts";
import { commandReply, parseCommand } from "../src/webhooks/core/commands.ts";
import { openEnvelope, RELAY_HEADERS, sealEnvelope } from "../src/webhooks/core/envelope.ts";
import { parseEnvironment } from "../src/webhooks/core/environments.ts";
import { signMetaPayload, verifyMetaPayload } from "../src/webhooks/core/signature.ts";
import { hookSource, instagramSource } from "../src/webhooks/core/sources/index.ts";
import { createWebhookCounters } from "../src/webhooks/counters.ts";
import { instanceEnvironment, relayCommandOf, routedHere } from "../src/webhooks/relay.ts";
import type { VerifiedDelivery, WebhookSink } from "../src/webhooks/routes.ts";
import { StoreSink } from "../src/webhooks/store-sink.ts";
import { clock, FakeMessenger, FakeProfiles, FakeStashh, MemoryStore } from "./support/fakes.ts";

const log = pino({ level: "silent" });
const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "verify-token-0123456789";
const RELAY_SECRET = "relay-secret-0123456789-0123456789";
const ACCOUNT = "17841429946098008";
const TEAMMATE = "28795997800021780";
const OTHER = "11112222333344445";

const dm = (sender: string, text: string, mid = `m-${text}`, extra: Record<string, unknown> = {}) => ({
  sender: { id: sender },
  recipient: { id: ACCOUNT },
  timestamp: 1_792_580_000_000,
  message: { mid, text, ...extra },
});
const delivery = (...messaging: unknown[]) => ({ object: "instagram", entry: [{ id: ACCOUNT, time: 1, messaging }] });

describe("the shared core", () => {
  it("signs like Node's HMAC over the raw body, and refuses a changed body or another secret", async () => {
    const body = '{"object":"instagram","entry":[{"id":"1","messaging":[{"message":{"text":"Merhaba \\u00e7ay"}}]}]}';
    const header = await signMetaPayload(body, APP_SECRET);
    expect(header).toBe(`sha256=${createHmac("sha256", APP_SECRET).update(body, "utf8").digest("hex")}`);
    expect(await verifyMetaPayload(body, header, APP_SECRET)).toBe(true);
    expect(await verifyMetaPayload(body.replace("1", "2"), header, APP_SECRET)).toBe(false);
    expect(await verifyMetaPayload(body, header, "other")).toBe(false);
    expect(await verifyMetaPayload(body, null, APP_SECRET)).toBe(false);
    expect(await verifyMetaPayload(body, header, "")).toBe(false);
  });

  it("reads environments and the usual short forms; there is no staging", () => {
    expect(parseEnvironment(" Production ")).toBe("prod");
    expect(parseEnvironment("prd")).toBe("prod");
    expect(parseEnvironment("development")).toBe("dev");
    expect(parseEnvironment("staging")).toBeNull();
    expect(parseEnvironment("")).toBeNull();
  });

  it("reads /env, /env <name> and /env=<name>, and nothing else", () => {
    expect(parseCommand("  /env  ")).toEqual({ kind: "env-show" });
    expect(parseCommand("/env dev")).toEqual({ kind: "env-set", env: "dev" });
    expect(parseCommand("/Env=PRD")).toEqual({ kind: "env-set", env: "prod" });
    expect(parseCommand("/env qa")).toEqual({ kind: "env-invalid", value: "qa" });
    expect(parseCommand("/env dev please")).toBeNull();
    expect(parseCommand("please /env dev")).toBeNull();
    expect(parseCommand("/environment dev")).toBeNull();
    expect(parseCommand(null)).toBeNull();
  });

  it("says where the account routes now, and how to come back", () => {
    expect(commandReply({ kind: "env-set", env: "dev", from: "prod" })).toBe("This account now routes to dev. Send /env prod to go back.");
    expect(commandReply({ kind: "env-set", env: "prod", from: "dev" })).toBe("This account now routes to prod.");
    expect(commandReply({ kind: "env-set", env: "dev", from: "dev" })).toBe("This account already routes to dev.");
    expect(commandReply({ kind: "env-show", env: "prod" })).toBe("This account routes to prod.");
    expect(commandReply({ kind: "env-invalid", env: "prod", value: "qa" })).toBe('"qa" is not an environment. Use /env dev, /env prod.');
    expect(commandReply({ kind: "env-unavailable", env: "prod", target: "dev" })).toBe(
      "dev cannot take this channel right now, so this account stays on prod.",
    );
  });

  it("round-trips the envelope; a tampered, forged or unsigned one does not hold", async () => {
    const body = JSON.stringify(delivery(dm(TEAMMATE, "/env dev")));
    const envelope = { env: "dev" as const, command: { kind: "env-set" as const, env: "dev" as const, from: "prod" as const } };
    const sealed = await sealEnvelope(envelope, body, RELAY_SECRET);
    expect(await openEnvelope(new Headers(sealed), body, RELAY_SECRET)).toEqual({ ok: true, envelope });
    expect(await openEnvelope(new Headers(), body, RELAY_SECRET)).toEqual({ ok: true, envelope: null });

    expect(await openEnvelope(new Headers(sealed), body + " ", RELAY_SECRET)).toEqual({ ok: false });
    expect(await openEnvelope(new Headers({ ...sealed, [RELAY_HEADERS.env]: "prod" }), body, RELAY_SECRET)).toEqual({ ok: false });
    expect(await openEnvelope(new Headers(sealed), body, "another-secret")).toEqual({ ok: false });
    expect(await openEnvelope(new Headers(sealed), body, undefined)).toEqual({ ok: false });
    expect(await openEnvelope(new Headers({ [RELAY_HEADERS.env]: "dev" }), body, RELAY_SECRET)).toEqual({ ok: false });
    const forged = { ...sealed, [RELAY_HEADERS.command]: btoa('{"kind":"env-show","env":"dev"}') };
    expect(await openEnvelope(new Headers(forged), body, RELAY_SECRET)).toEqual({ ok: false });
  });

  it("cuts a delivery by the party that is not the account, echoes by their recipient", () => {
    const echo = { sender: { id: ACCOUNT }, recipient: { id: OTHER }, timestamp: 2, message: { mid: "e1", text: "Found 3", is_echo: true } };
    const self = { sender: { id: ACCOUNT }, recipient: { id: ACCOUNT }, timestamp: 3, message: { mid: "s1", text: "self", is_echo: true } };
    const slices = instagramSource.split(delivery(dm(TEAMMATE, "/env dev"), echo, dm(OTHER, "a reel"), self))!;
    expect(slices.map((slice) => slice.key)).toEqual([`instagram:${TEAMMATE}`, `instagram:${OTHER}`, null]);
    expect(instagramSource.typedTexts(slices[0]!.entry)).toEqual([{ index: 0, text: "/env dev" }]);
    expect(instagramSource.typedTexts(slices[1]!.entry)).toEqual([{ index: 1, text: "a reel" }]);
    expect(instagramSource.split({ object: "page", entry: [] })).toBeNull();
    expect(hookSource("instagram")).toBe(instagramSource);
    expect(hookSource("constructor")).toBeNull();
  });
});

describe("this instance and the relay", () => {
  it("is prod only in the production container", () => {
    expect(instanceEnvironment("production")).toBe("prod");
    expect(instanceEnvironment("development")).toBe("dev");
    expect(instanceEnvironment("test")).toBe("dev");
  });

  it("treats a message as a command only when the relay vouched for it and the text is one", () => {
    const envelope = { env: "dev" as const, command: { kind: "env-show" as const, env: "dev" as const } };
    expect(relayCommandOf({ text: "/env", attachments: [] }, envelope)).toEqual(envelope.command);
    expect(relayCommandOf({ text: "Merhaba", attachments: [] }, envelope)).toBeNull();
    expect(relayCommandOf({ text: "/env", attachments: [{ type: "ig_reel" }] }, envelope)).toBeNull();
    expect(relayCommandOf({ text: "/env", attachments: [] }, { env: "dev", command: null })).toBeNull();
    expect(relayCommandOf({ text: "/env", attachments: [] }, null)).toBeNull();
  });

  it("counts a sender as routed here only when the envelope names this environment", () => {
    expect(routedHere({ env: "dev", command: null }, "dev")).toBe(true);
    expect(routedHere({ env: "prod", command: null }, "dev")).toBe(false);
    expect(routedHere(null, "dev")).toBe(false);
  });

  it("writes to anyone in production, only to routed senders elsewhere unless told otherwise, and fails closed", () => {
    expect(outboundMode("prod", "off")).toBe("live");
    expect(outboundMode("dev", undefined)).toBe("routed");
    expect(outboundMode("dev", " ")).toBe("routed");
    expect(outboundMode("dev", "live")).toBe("live");
    expect(outboundMode("dev", "off")).toBe("off");
    expect(outboundMode("dev", "yes please")).toBe("off");

    expect(mayMessage("live", { relayRouted: false })).toBe(true);
    expect(mayMessage("routed", { relayRouted: true })).toBe(true);
    expect(mayMessage("routed", { relayRouted: false })).toBe(false);
    expect(mayMessage("off", { relayRouted: true })).toBe(false);
  });
});

class RecordingSink implements WebhookSink {
  deliveries: VerifiedDelivery[] = [];
  async accept(delivery: VerifiedDelivery): Promise<void> {
    this.deliveries.push(delivery);
  }
}

describe("the webhook behind the relay", () => {
  const sink = new RecordingSink();
  const servers: Server[] = [];
  let withRelay: string;
  let withoutRelay: string;

  async function listen(relaySecret: string | undefined): Promise<string> {
    const app = createApp({ appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN, relaySecret, sink, counters: createWebhookCounters(), log });
    const server = app.listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  beforeAll(async () => {
    withRelay = await listen(RELAY_SECRET);
    withoutRelay = await listen(undefined);
  });
  afterAll(() => Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));
  beforeEach(() => {
    sink.deliveries = [];
  });

  async function post(base: string, payload: unknown, headers: (body: string) => Promise<Record<string, string>> = async () => ({})) {
    const body = JSON.stringify(payload);
    return fetch(`${base}/webhooks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": await signMetaPayload(body, APP_SECRET), ...(await headers(body)) },
      body,
    });
  }

  it("answers the relay's probe with 204 and nothing else, only when it can open the envelope", async () => {
    const probe = await fetch(`${withRelay}/webhooks?relay=probe`);
    expect(probe.status).toBe(204);
    expect(await probe.text()).toBe("");
    expect((await fetch(`${withRelay}/webhooks/instagram?relay=probe`)).status).toBe(204);
    expect((await fetch(`${withRelay}/webhooks?relay=probe&hub.mode=subscribe`)).status).toBe(403);
    expect((await fetch(`${withoutRelay}/webhooks?relay=probe`)).status).toBe(403);
    // The handshake is untouched.
    expect(await (await fetch(`${withRelay}/webhooks?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=7`)).text()).toBe("7");
  });

  it("hands a direct delivery on without an envelope, with or without the relay configured", async () => {
    expect((await post(withRelay, delivery(dm(OTHER, "hi")))).status).toBe(200);
    expect((await post(withoutRelay, delivery(dm(OTHER, "hi")))).status).toBe(200);
    expect(sink.deliveries.map((d) => d.relay)).toEqual([null, null]);
  });

  it("passes on the relay's envelope, and refuses one that does not hold", async () => {
    const envelope = { env: "dev" as const, command: { kind: "env-show" as const, env: "dev" as const } };
    expect((await post(withRelay, delivery(dm(TEAMMATE, "/env")), (body) => sealEnvelope(envelope, body, RELAY_SECRET))).status).toBe(200);
    expect(sink.deliveries[0]?.relay).toEqual(envelope);

    sink.deliveries = [];
    const wrongSecret = (body: string) => sealEnvelope(envelope, body, "not-the-relay-secret-0123456789");
    expect((await post(withRelay, delivery(dm(TEAMMATE, "/env")), wrongSecret)).status).toBe(403);
    const sealedForAnother = async () => sealEnvelope(envelope, "{}", RELAY_SECRET);
    expect((await post(withRelay, delivery(dm(TEAMMATE, "/env")), sealedForAnother)).status).toBe(403);
    // Without the secret no envelope can hold.
    expect((await post(withoutRelay, delivery(dm(TEAMMATE, "/env")), (body) => sealEnvelope(envelope, body, RELAY_SECRET))).status).toBe(403);
    expect(sink.deliveries).toEqual([]);
  });
});

describe("relayed messages, stored and answered", () => {
  let time: ReturnType<typeof clock>;
  let store: MemoryStore;
  let messenger: FakeMessenger;
  let stashh: FakeStashh;

  beforeEach(() => {
    time = clock();
    store = new MemoryStore(time.now);
    messenger = new FakeMessenger();
    stashh = new FakeStashh();
  });

  const accept = (environment: "dev" | "prod", payload: unknown, relay: VerifiedDelivery["relay"]) =>
    new StoreSink({ store, accountId: ACCOUNT, environment, log }).accept({
      rawBody: Buffer.alloc(0),
      body: payload as VerifiedDelivery["body"],
      relay,
      receivedAt: time.now(),
    });

  const processor = (outbound: "live" | "routed" | "off") =>
    new MessageProcessor({ store, stashh, messenger, profiles: new FakeProfiles(), log, outbound, now: time.now });

  async function tick(outbound: "live" | "routed" | "off") {
    const p = processor(outbound);
    for (const message of await store.claim(10, 60)) await p.process(message);
  }

  it("marks senders routed only by an envelope naming this environment", async () => {
    await accept("dev", delivery(dm(TEAMMATE, "a", "m1")), { env: "dev", command: null });
    await accept("dev", delivery(dm(TEAMMATE, "b", "m2")), { env: "prod", command: null });
    await accept("dev", delivery(dm(TEAMMATE, "c", "m3")), null);
    expect([...store.rows.values()].map((row) => [row.mid, row.relayRouted])).toEqual([
      ["m1", true],
      ["m2", false],
      ["m3", false],
    ]);
  });

  it("answers a /env command with what the relay did, through the Send API, and never recognizes it", async () => {
    const command = { kind: "env-set" as const, env: "dev" as const, from: "prod" as const };
    await accept("dev", delivery(dm(TEAMMATE, "/env dev", "cmd")), { env: "dev", command });
    await tick("routed");

    expect(messenger.sent).toEqual([{ to: TEAMMATE, message: { kind: "text", text: "This account now routes to dev. Send /env prod to go back." } }]);
    expect(store.row("cmd")).toMatchObject({ status: "replied", intent: "env", relayCommand: command });
    expect(stashh.created).toEqual([]);
  });

  it("reads a /env that came straight from Meta as an ordinary message", async () => {
    await accept("prod", delivery(dm(OTHER, "/env dev", "direct")), null);
    await tick("live");
    expect(store.row("direct")).toMatchObject({ intent: "help", relayCommand: null });
  });

  it("outside production, answers only routed senders and works on nobody else's message", async () => {
    await accept("dev", delivery(dm(TEAMMATE, "https://www.instagram.com/reel/abc/", "routed")), { env: "dev", command: null });
    await accept("dev", delivery(dm(OTHER, "https://www.instagram.com/reel/xyz/", "direct")), null);
    await tick("routed");

    expect(store.row("direct")).toMatchObject({ status: "failed", lastError: OUTBOUND_BLOCKED });
    expect(store.row("routed").status).toBe("submitted");
    expect(stashh.created.map((c) => c.idempotencyKey)).toEqual(["routed"]);
    expect(messenger.typed).toEqual([TEAMMATE]);
    expect(messenger.sent).toEqual([]);
  });

  it("writes to no one when outbound is off, routed or not", async () => {
    await accept("dev", delivery(dm(TEAMMATE, "/env", "cmd")), { env: "dev", command: { kind: "env-show", env: "dev" } });
    await tick("off");
    expect(messenger.sent).toEqual([]);
    expect(store.row("cmd")).toMatchObject({ status: "failed", lastError: OUTBOUND_BLOCKED });
  });
});
