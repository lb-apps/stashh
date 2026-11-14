import { parseCommand, type CommandOutcome } from "../../../instagram/src/webhooks/core/commands.ts";
import { sealEnvelope } from "../../../instagram/src/webhooks/core/envelope.ts";
import type { Environment } from "../../../instagram/src/webhooks/core/environments.ts";
import { signMetaPayload, verifyMetaPayload } from "../../../instagram/src/webhooks/core/signature.ts";
import { hookSource, type HookSource } from "../../../instagram/src/webhooks/core/sources/index.ts";
import { DELIVERY_TIMEOUT_MS, deliverDirect, postDelivery, probeTarget, queueForProd, targetUrl } from "./deliver.ts";
import { routeStore, type Routes } from "./routes.ts";
import type { QueuedDelivery, Runtime } from "./runtime.ts";

/**
 * The whole relay, start to finish.
 *
 *   GET  /meta/<source>   Meta's verification handshake, answered by the default environment.
 *   POST /meta/<source>   check Meta's signature → cut the delivery by sender → look up each
 *                         sender's environment → apply chat commands → re-sign each part → deliver.
 *   GET  /health          "ok", for uptime checks.
 *
 * Prod is delivered while Meta waits. What prod does not take (unreachable, 429 or 5xx) waits in the
 * queue for up to a day and Meta gets its 200, so an outage at home loses no message and ends the
 * moment prod is back; a refusal (4xx) stays Meta's answer. Dev is posted right after that answer,
 * in the background, and only what could not be delivered waits in the queue; Meta gets its 200
 * regardless: a closed tunnel must never make Meta unsubscribe the app.
 */
export async function handleRequest(request: Request, rt: Runtime): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/health") return new Response("ok");

  const match = /^\/meta\/([a-z]+)\/?$/.exec(url.pathname);
  const source = match?.[1] ? hookSource(match[1]) : null;
  if (!source) return new Response("not found", { status: 404 });

  if (request.method === "GET") return handshake(source, url, rt);
  if (request.method === "POST") return relay(source, request, rt);
  return new Response("method not allowed", { status: 405, headers: { allow: "GET, POST" } });
}

async function handshake(source: HookSource, url: URL, rt: Runtime): Promise<Response> {
  const env = rt.config.defaultEnv;
  try {
    const response = await rt.fetch(targetUrl(rt, env, source.id, url.search), {
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    rt.log("handshake", { source: source.id, env, status: response.status });
    return new Response(await response.text(), { status: response.status, headers: { "content-type": "text/plain" } });
  } catch {
    rt.log("handshake_failed", { source: source.id, env });
    return new Response("unavailable", { status: 502 });
  }
}

interface Routed {
  env: Environment;
  entry: unknown;
  command: CommandOutcome | null;
}

/**
 * Where one sender's part goes, after their chat commands. Anyone may route their own account with
 * `/env` (no registration): an instance outside production answers only accounts the relay routed
 * to it, so a stray `/env dev` costs nothing but that person's replies until `/env prod`.
 */
async function routeSlice(source: HookSource, key: string, entry: unknown, routes: Routes, rt: Runtime): Promise<Routed> {
  let env = await routes.envOf(key);
  let command: CommandOutcome | null = null;

  for (const { text } of source.typedTexts(entry)) {
    const parsed = parseCommand(text);
    if (!parsed) continue;

    if (parsed.kind === "env-show") {
      command = { kind: "env-show", env };
    } else if (parsed.kind === "env-invalid") {
      command = { kind: "env-invalid", env, value: parsed.value };
    } else if (parsed.env !== env && !(await probeTarget(rt, parsed.env, source.id))) {
      // Routing someone where nothing answers would lose every message they send next.
      command = { kind: "env-unavailable", env, target: parsed.env };
      rt.log("env_unavailable", { source: source.id, env, target: parsed.env });
    } else {
      const from = env;
      env = parsed.env;
      await routes.setEnv(key, env);
      command = { kind: "env-set", env, from };
      rt.log("env_set", { source: source.id, env, from });
    }
  }

  return { env, entry, command };
}

interface Delivery {
  env: Environment;
  /** The parts this request carries; null: the original body, untouched. */
  entries: unknown[] | null;
  command: CommandOutcome | null;
}

async function relay(source: HookSource, request: Request, rt: Runtime): Promise<Response> {
  const started = rt.now();
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const secret = rt.config.secrets[source.id];
  if (!(await verifyMetaPayload(body, signature, secret))) {
    rt.log("signature_refused", { source: source.id });
    return new Response("invalid signature", { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    // Signed by Meta but not JSON: the instance would answer 200 and do nothing, so does the relay.
    return new Response(null, { status: 200 });
  }

  const deliveries: Delivery[] = [];
  const slices = source.split(payload);
  if (slices === null) {
    // Not a shape we know how to cut: all of it to the default environment, as Meta sent it.
    deliveries.push({ env: rt.config.defaultEnv, entries: null, command: null });
  } else {
    const routes = routeStore(rt.routes, rt.config.defaultEnv, rt.now);
    const merged = new Map<Environment, unknown[]>();
    const add = (env: Environment, entry: unknown) => merged.set(env, [...(merged.get(env) ?? []), entry]);
    for (const slice of slices) {
      if (slice.key === null) {
        add(rt.config.defaultEnv, slice.entry);
        continue;
      }
      const routed = await routeSlice(source, slice.key, slice.entry, routes, rt);
      // A command travels alone: its envelope speaks for that one sender.
      if (routed.command) deliveries.push({ env: routed.env, entries: [routed.entry], command: routed.command });
      else add(routed.env, routed.entry);
    }
    for (const [env, entries] of merged) deliveries.push({ env, entries, command: null });
  }

  const prepared = await Promise.all(
    deliveries.map(async (delivery): Promise<QueuedDelivery> => {
      const out = delivery.entries === null ? body : JSON.stringify(source.assemble(payload, delivery.entries));
      return {
        env: delivery.env,
        source: source.id,
        body: out,
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": delivery.entries === null && signature ? signature : await signMetaPayload(out, secret),
          ...(await sealEnvelope({ env: delivery.env, command: delivery.command }, out, rt.config.relaySecret)),
        },
      };
    }),
  );

  const now = prepared.filter((delivery) => delivery.env === "prod");
  const background = prepared.filter((delivery) => delivery.env !== "prod");
  if (background.length > 0) rt.waitUntil(Promise.all(background.map((delivery) => deliverDirect(rt, delivery))));

  const results = await Promise.all(
    now.map(async (delivery) => {
      const status = await postDelivery(rt, delivery);
      return { status, queued: await queueForProd(rt, delivery, status) };
    }),
  );
  const failed = results.find(({ status, queued }) => !queued && (status < 200 || status >= 300))?.status;
  rt.log("relayed", {
    source: source.id,
    slices: slices?.length ?? null,
    prod: now.length,
    queued: results.filter(({ queued }) => queued).length,
    background: background.length,
    status: failed ?? 200,
    ms: rt.now() - started,
  });
  if (failed === undefined) return new Response(null, { status: 200 });
  // Prod refused it, or the queue could not hold it: Meta delivers the whole batch again. Parts
  // already delivered elsewhere arrive twice, and every instance drops a repeat by its message id.
  return new Response("not delivered", { status: failed === 0 ? 503 : failed });
}
