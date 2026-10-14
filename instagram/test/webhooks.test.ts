import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { pino } from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/http/app.ts";
import type { VerifiedDelivery, WebhookSink } from "../src/webhooks/routes.ts";
import { isValidSignature } from "../src/webhooks/signature.ts";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "verify-token-0123456789";

function sign(body: string, secret = APP_SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

class RecordingSink implements WebhookSink {
  deliveries: VerifiedDelivery[] = [];
  failNext = false;
  async accept(delivery: VerifiedDelivery): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("db down");
    }
    this.deliveries.push(delivery);
  }
}

describe("isValidSignature", () => {
  const body = Buffer.from('{"a":"\\u00e7"}');

  it("accepts the HMAC of the exact bytes", () => {
    expect(isValidSignature(body, sign(body.toString()), APP_SECRET)).toBe(true);
  });

  it("rejects a different secret, a missing prefix, garbage and absence", () => {
    expect(isValidSignature(body, sign(body.toString(), "other"), APP_SECRET)).toBe(false);
    expect(isValidSignature(body, sign(body.toString()).slice("sha256=".length), APP_SECRET)).toBe(false);
    expect(isValidSignature(body, "sha256=zz", APP_SECRET)).toBe(false);
    expect(isValidSignature(body, undefined, APP_SECRET)).toBe(false);
  });

  it("is sensitive to re-serialisation", () => {
    const reserialised = JSON.stringify(JSON.parse(body.toString()));
    expect(isValidSignature(Buffer.from(reserialised), sign(body.toString()), APP_SECRET)).toBe(false);
  });
});

describe("webhook routes", () => {
  const sink = new RecordingSink();
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp({ appSecret: APP_SECRET, verifyToken: VERIFY_TOKEN, sink, log: pino({ level: "silent" }) });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhooks/instagram`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  beforeEach(() => {
    sink.deliveries = [];
  });

  const post = (body: string, signature: string | null = sign(body)) =>
    fetch(baseUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
      body,
    });

  it("echoes the challenge for the right verify token", async () => {
    const res = await fetch(`${baseUrl}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=42`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("42");
  });

  it("refuses the handshake for a wrong token", async () => {
    const res = await fetch(`${baseUrl}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`);
    expect(res.status).toBe(403);
  });

  it("hands a signed delivery to the sink with its raw bytes", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [{ id: "1", time: 1, messaging: [] }] });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(sink.deliveries).toHaveLength(1);
    expect(sink.deliveries[0]?.rawBody.toString()).toBe(body);
  });

  it("rejects an unsigned or mis-signed delivery", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    expect((await post(body, null)).status).toBe(401);
    expect((await post(body, sign(body, "wrong"))).status).toBe(401);
    expect(sink.deliveries).toHaveLength(0);
  });

  it("acknowledges but drops a signed body of another object type", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    expect((await post(body)).status).toBe(200);
    expect(sink.deliveries).toHaveLength(0);
  });

  it("returns 500 when the sink cannot persist, so Meta redelivers", async () => {
    sink.failNext = true;
    const body = JSON.stringify({ object: "instagram", entry: [] });
    expect((await post(body)).status).toBe(500);
  });
});
