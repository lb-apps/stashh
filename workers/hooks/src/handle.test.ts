import { describe, expect, it } from "vitest";
import { openEnvelope } from "../../../instagram/src/webhooks/core/envelope.ts";
import { signMetaPayload, verifyMetaPayload } from "../../../instagram/src/webhooks/core/signature.ts";
import { deliverQueued, retryDelaySeconds } from "./deliver.ts";
import { handleRequest } from "./handle.ts";
import type { QueuedDelivery, Runtime } from "./runtime.ts";

const IG_SECRET = "ig-secret";
const RELAY_SECRET = "relay-secret";
const ACCOUNT = "17841429946098008";
const TEAMMATE = "28795997800021780";
const USER = "11112222333344445";

interface Sent {
  url: string;
  init: RequestInit;
}

function harness(
  options: { prodStatus?: number | "down"; routes?: Record<string, string>; unreachable?: string[]; down?: string[]; queueDown?: boolean } = {},
) {
  const kv = new Map<string, string>(Object.entries(options.routes ?? {}));
  const queued: QueuedDelivery[] = [];
  const sent: Sent[] = [];
  const pending: Promise<unknown>[] = [];
  const logs: Array<{ event: string; fields?: Record<string, unknown> }> = [];

  const rt: Runtime = {
    config: {
      defaultEnv: "prod",
      targets: { prod: "https://prod.test", dev: "https://dev.test" },
      secrets: { instagram: IG_SECRET },
      relaySecret: RELAY_SECRET,
    },
    routes: {
      get: async (key) => kv.get(key) ?? null,
      put: async (key, value) => void kv.set(key, value),
      delete: async (key) => void kv.delete(key),
    },
    queue: {
      send: async (delivery) => {
        if (options.queueDown) throw new Error("queue unavailable");
        queued.push(delivery);
      },
    },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("?relay=probe")) {
        const down = (options.unreachable ?? []).some((origin) => url.startsWith(origin));
        return new Response(null, { status: down ? 404 : 204 });
      }
      sent.push({ url, init: init ?? {} });
      if ((options.down ?? []).some((origin) => url.startsWith(origin))) throw new Error("tunnel closed");
      if (url.startsWith("https://prod.test")) {
        if (options.prodStatus === "down") throw new Error("connect ECONNREFUSED");
        return new Response(init?.method === "POST" ? "{}" : "challenge-42", { status: options.prodStatus ?? 200 });
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch,
    waitUntil: (promise) => void pending.push(promise),
    now: () => 1_792_580_000_000,
    log: (event, fields) => void logs.push({ event, ...(fields ? { fields } : {}) }),
  };

  async function post(path: string, payload: unknown, secret = IG_SECRET) {
    const body = JSON.stringify(payload);
    const response = await handleRequest(
      new Request(`https://hooks.test${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hub-signature-256": await signMetaPayload(body, secret) },
        body,
      }),
      rt,
    );
    await Promise.all(pending);
    return response;
  }

  return { rt, kv, queued, sent, logs, post };
}

function igMessage(sender: string, text: string, mid = `m-${text}`) {
  return { sender: { id: sender }, recipient: { id: ACCOUNT }, timestamp: 1, message: { mid, text } };
}

function igDelivery(...messaging: unknown[]) {
  return { object: "instagram", entry: [{ id: ACCOUNT, time: 1, messaging }] };
}

async function opened(delivery: { body: string; headers: Record<string, string> }) {
  const envelope = await openEnvelope(new Headers(delivery.headers), delivery.body, RELAY_SECRET);
  if (!envelope.ok) throw new Error("envelope did not open");
  return envelope.envelope;
}

function postsTo(sent: Sent[], origin: string) {
  return sent
    .filter((request) => request.url.startsWith(origin) && request.init.method === "POST")
    .map((request) => ({ body: String(request.init.body), headers: request.init.headers as Record<string, string> }));
}

const prodPosts = (sent: Sent[]) => postsTo(sent, "https://prod.test");
const devPosts = (sent: Sent[]) => postsTo(sent, "https://dev.test");

describe("routing", () => {
  it("sends everyone to prod by default, re-signed and sealed, and answers with prod's answer", async () => {
    const h = harness();
    const response = await h.post("/meta/instagram", igDelivery(igMessage(USER, "Merhaba")));
    expect(response.status).toBe(200);
    expect(h.queued).toEqual([]);

    const [delivery] = prodPosts(h.sent);
    expect(h.sent[0]?.url).toBe("https://prod.test/webhooks");
    expect(JSON.parse(delivery!.body)).toEqual(igDelivery(igMessage(USER, "Merhaba")));
    expect(await verifyMetaPayload(delivery!.body, delivery!.headers["x-hub-signature-256"] ?? null, IG_SECRET)).toBe(true);
    expect(await opened(delivery!)).toEqual({ env: "prod", command: null });
  });

  it("queues what prod cannot take now, exactly as posted, and Meta gets its 200", async () => {
    for (const prodStatus of [503, 530, 429, "down"] as const) {
      const h = harness({ prodStatus });
      const response = await h.post("/meta/instagram", igDelivery(igMessage(USER, "Merhaba")));
      expect(response.status).toBe(200);
      expect(h.queued).toHaveLength(1);
      const [held] = h.queued;
      expect(held).toEqual({ env: "prod", source: "instagram", ...prodPosts(h.sent)[0] });
      expect(await opened(held!)).toEqual({ env: "prod", command: null });
      expect(h.logs.find(({ event }) => event === "relayed")?.fields).toMatchObject({ prod: 1, queued: 1, status: 200 });
    }
  });

  it("lets Meta retry a refusal, and what the queue cannot hold", async () => {
    const refused = harness({ prodStatus: 403 });
    expect((await refused.post("/meta/instagram", igDelivery(igMessage(USER, "Merhaba")))).status).toBe(403);
    expect(refused.queued).toEqual([]);

    const queueDown = harness({ prodStatus: "down", queueDown: true });
    expect((await queueDown.post("/meta/instagram", igDelivery(igMessage(USER, "Merhaba")))).status).toBe(503);

    const oversized = harness({ prodStatus: 530 });
    expect((await oversized.post("/meta/instagram", igDelivery(igMessage(USER, "x".repeat(130_000))))).status).toBe(530);
    expect(oversized.queued).toEqual([]);
  });

  it("cuts a delivery between environments: a routed sender is posted to dev in the background, the rest to prod", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    const response = await h.post("/meta/instagram", igDelivery(igMessage(USER, "a reel"), igMessage(TEAMMATE, "test 1")));
    expect(response.status).toBe(200);

    const [prod] = prodPosts(h.sent);
    expect(JSON.parse(prod!.body).entry[0].messaging).toEqual([igMessage(USER, "a reel")]);

    const [dev] = devPosts(h.sent);
    expect(h.sent.find((request) => request.url.startsWith("https://dev.test"))?.url).toBe("https://dev.test/webhooks");
    expect(JSON.parse(dev!.body).entry[0].messaging).toEqual([igMessage(TEAMMATE, "test 1")]);
    expect(await verifyMetaPayload(dev!.body, dev!.headers["x-hub-signature-256"] ?? null, IG_SECRET)).toBe(true);
    expect(await opened(dev!)).toEqual({ env: "dev", command: null });
    // Delivered, so nothing waits in the queue.
    expect(h.queued).toEqual([]);
    expect(h.logs.find((log) => log.event === "direct_delivery")?.fields).toMatchObject({ env: "dev", status: 200, outcome: "delivered" });
  });

  it("answers 200 at once when nothing goes to prod", async () => {
    const h = harness({ prodStatus: 503, routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    const response = await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "test")));
    expect(response.status).toBe(200);
    expect(prodPosts(h.sent)).toEqual([]);
    expect(devPosts(h.sent)).toHaveLength(1);
    expect(h.queued).toEqual([]);
  });

  it("queues only what could not be delivered after two tries, and Meta still gets 200", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' }, down: ["https://dev.test"] });
    const response = await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "to the Mac"), igMessage(USER, "to prod")));
    expect(response.status).toBe(200);

    expect(prodPosts(h.sent)).toHaveLength(1);
    expect(devPosts(h.sent)).toHaveLength(2);
    expect(h.queued).toHaveLength(1);
    const [dev] = h.queued;
    expect(dev?.env).toBe("dev");
    expect(JSON.parse(dev!.body).entry[0].messaging).toEqual([igMessage(TEAMMATE, "to the Mac")]);
    expect(await opened(dev!)).toEqual({ env: "dev", command: null });
    const attempts = h.logs.filter((log) => log.event === "direct_delivery").map((log) => log.fields);
    expect(attempts).toEqual([
      expect.objectContaining({ attempt: 1, status: 0, outcome: "retry" }),
      expect.objectContaining({ attempt: 2, status: 0, outcome: "retry" }),
    ]);
  });

  it("lands on the second try when the first stalls, and nothing is queued", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    let posts = 0;
    const fetchOnce = h.rt.fetch;
    h.rt.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("https://dev.test") && init?.method === "POST" && ++posts === 1) throw new Error("stalled");
      return fetchOnce(input, init);
    }) as typeof fetch;
    expect((await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "a reel")))).status).toBe(200);
    expect(posts).toBe(2);
    expect(h.queued).toEqual([]);
    expect(h.logs.filter((log) => log.event === "direct_delivery").map((log) => log.fields?.["outcome"])).toEqual(["retry", "delivered"]);
  });

  it("routes an echo of our own reply by its recipient, so it follows the sender it answered", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    const echo = { sender: { id: ACCOUNT }, recipient: { id: TEAMMATE }, timestamp: 2, message: { mid: "e1", text: "Found 3 places", is_echo: true } };
    expect((await h.post("/meta/instagram", igDelivery(echo))).status).toBe(200);
    expect(prodPosts(h.sent)).toEqual([]);
    expect(JSON.parse(devPosts(h.sent)[0]!.body).entry[0].messaging).toEqual([echo]);
  });

  it("never logs a body or a sender id", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "/env prod"), igMessage(USER, "secret words")));
    const logged = JSON.stringify(h.logs);
    for (const value of [TEAMMATE, USER, ACCOUNT, "secret words", "/env prod"]) expect(logged).not.toContain(value);
  });
});

describe("commands", () => {
  it("routes anyone who sends /env dev, and dev answers the command", async () => {
    const h = harness();
    await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "/env dev"), igMessage(USER, "Merhaba")));
    expect(JSON.parse(h.kv.get(`route:instagram:${TEAMMATE}`)!)).toMatchObject({ env: "dev" });

    const dev = devPosts(h.sent);
    expect(dev).toHaveLength(1);
    expect(await opened(dev[0]!)).toEqual({ env: "dev", command: { kind: "env-set", env: "dev", from: "prod" } });
    // The command travels alone; the other sender's message is prod's.
    expect(JSON.parse(prodPosts(h.sent)[0]!.body).entry[0].messaging).toEqual([igMessage(USER, "Merhaba")]);
  });

  it("keeps the account where it is when dev cannot take the channel", async () => {
    const h = harness({ unreachable: ["https://dev.test"] });
    await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "/env development")));
    expect(h.kv.has(`route:instagram:${TEAMMATE}`)).toBe(false);
    // The answer comes from where the account still is (prod), so somebody sends it.
    expect(await opened(prodPosts(h.sent)[0]!)).toEqual({ env: "prod", command: { kind: "env-unavailable", env: "prod", target: "dev" } });
    expect(h.queued).toEqual([]);
  });

  it("leaves a sentence that merely mentions /env as an ordinary message", async () => {
    const h = harness();
    await h.post("/meta/instagram", igDelivery(igMessage(USER, "please /env dev")));
    expect(h.kv.size).toBe(0);
    const [prod] = prodPosts(h.sent);
    expect(await opened(prod!)).toEqual({ env: "prod", command: null });
  });

  it("does not read a command out of a share's caption", async () => {
    const h = harness();
    const share = { sender: { id: USER }, recipient: { id: ACCOUNT }, timestamp: 1, message: { mid: "s1", text: "/env dev", attachments: [{ type: "ig_reel", payload: { url: "https://www.instagram.com/reel/x/" } }] } };
    await h.post("/meta/instagram", igDelivery(share));
    expect(h.kv.size).toBe(0);
    expect(await opened(prodPosts(h.sent)[0]!)).toEqual({ env: "prod", command: null });
  });

  it("forgets the route on /env prod, so the store lists only who is away", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "/env prod")));
    expect(h.kv.has(`route:instagram:${TEAMMATE}`)).toBe(false);
    expect(await opened(prodPosts(h.sent)[0]!)).toEqual({ env: "prod", command: { kind: "env-set", env: "prod", from: "dev" } });
  });

  it("shows the environment and explains a name it does not know", async () => {
    const h = harness({ routes: { [`route:instagram:${TEAMMATE}`]: '{"env":"dev"}' } });
    await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "/env")));
    await h.post("/meta/instagram", igDelivery(igMessage(TEAMMATE, "/env staging")));
    const dev = devPosts(h.sent);
    expect(await opened(dev[0]!)).toEqual({ env: "dev", command: { kind: "env-show", env: "dev" } });
    expect(await opened(dev[1]!)).toEqual({ env: "dev", command: { kind: "env-invalid", env: "dev", value: "staging" } });
  });
});

describe("the rest of the surface", () => {
  it("answers Meta's handshake from the default environment", async () => {
    const h = harness();
    const response = await handleRequest(
      new Request("https://hooks.test/meta/instagram?hub.mode=subscribe&hub.verify_token=t&hub.challenge=42"),
      h.rt,
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-42");
    expect(h.sent[0]?.url).toBe("https://prod.test/webhooks?hub.mode=subscribe&hub.verify_token=t&hub.challenge=42");
  });

  it("passes a shape it cannot cut to the default environment untouched", async () => {
    const h = harness();
    const body = JSON.stringify({ object: "page", entry: [] });
    const signature = await signMetaPayload(body, IG_SECRET);
    const response = await handleRequest(
      new Request("https://hooks.test/meta/instagram", { method: "POST", headers: { "x-hub-signature-256": signature }, body }),
      h.rt,
    );
    expect(response.status).toBe(200);
    const [prod] = prodPosts(h.sent);
    expect(prod?.body).toBe(body);
    expect(prod?.headers["x-hub-signature-256"]).toBe(signature);
  });

  it("refuses a bad signature, an unknown path and other methods", async () => {
    const h = harness();
    const refused = await handleRequest(
      new Request("https://hooks.test/meta/instagram", { method: "POST", headers: { "x-hub-signature-256": "sha256=00" }, body: "{}" }),
      h.rt,
    );
    expect(refused.status).toBe(403);
    expect((await h.post("/meta/instagram", igDelivery(igMessage(USER, "hi")), "another-secret")).status).toBe(403);
    expect((await handleRequest(new Request("https://hooks.test/meta/whatsapp"), h.rt)).status).toBe(404);
    expect((await handleRequest(new Request("https://hooks.test/meta/instagram", { method: "PUT" }), h.rt)).status).toBe(405);
    expect(await (await handleRequest(new Request("https://hooks.test/health"), h.rt)).text()).toBe("ok");
    expect(h.sent).toEqual([]);
  });
});

describe("queued deliveries", () => {
  const delivery: QueuedDelivery = { env: "dev", source: "instagram", body: "{}", headers: { "content-type": "application/json" } };

  it("post to the environment, retry what may pass later, drop a refusal", async () => {
    const h = harness();
    expect(await deliverQueued(h.rt, delivery)).toBe("delivered");
    expect(h.sent[0]?.url).toBe("https://dev.test/webhooks");

    const status = (code: number) => ({ ...h.rt, fetch: (async () => new Response(null, { status: code })) as typeof fetch });
    expect(await deliverQueued(status(503), delivery)).toBe("retry");
    expect(await deliverQueued(status(429), delivery)).toBe("retry");
    expect(await deliverQueued(status(403), delivery)).toBe("dropped");
    const down = { ...h.rt, fetch: (async () => Promise.reject(new Error("tunnel closed"))) as typeof fetch };
    expect(await deliverQueued(down, delivery)).toBe("retry");
  });

  it("back off from 30 seconds to every 15 minutes", () => {
    expect([1, 2, 3, 4, 5, 6, 9, 100].map(retryDelaySeconds)).toEqual([30, 60, 120, 240, 480, 900, 900, 900]);
  });

  it("hold a delivery for about a day, Instagram's reply window, over the queue's 100 tries", () => {
    // 100 is `max_retries` of both consumers in wrangler.jsonc.
    const held = Array.from({ length: 100 }, (_, i) => retryDelaySeconds(i + 1)).reduce((sum, s) => sum + s, 0);
    expect(held / 3600).toBeGreaterThan(23.5);
    expect(held / 3600).toBeLessThan(24.5);
  });
});
