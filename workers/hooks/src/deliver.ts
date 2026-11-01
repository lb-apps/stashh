import { RELAY_PROBE_QUERY } from "../../../instagram/src/webhooks/core/commands.ts";
import type { Environment } from "../../../instagram/src/webhooks/core/environments.ts";
import type { HookSourceId } from "../../../instagram/src/webhooks/core/sources/index.ts";
import type { QueuedDelivery, Runtime } from "./runtime.ts";

/** Meta wants an answer within seconds; prod gets this long before the relay gives up and Meta retries. */
export const DELIVERY_TIMEOUT_MS = 8_000;

/**
 * A dev delivery runs after Meta has its 200, so it may wait out a dev server that is restarting.
 * Two attempts: a stall on the tunnel's connection clears on a fresh one. Both fit the 30 s
 * `waitUntil` allows.
 */
export const DIRECT_TIMEOUT_MS = 10_000;
export const DIRECT_ATTEMPTS = 2;

/** A retry from the queue has nobody waiting on it at all. */
export const QUEUED_TIMEOUT_MS = 20_000;

/** A Queue message holds at most 128 KB; a larger delivery that did not land is lost, and logged. */
const QUEUE_LIMIT_BYTES = 120_000;

/** A probe runs inside Meta's wait, so it gets less. */
const PROBE_TIMEOUT_MS = 3_000;

/** Where each source's webhook lives on an instance (`instagram/src/http/app.ts`). */
const WEBHOOK_PATHS: Record<HookSourceId, string> = {
  instagram: "/webhooks",
};

/**
 * Whether an environment serves this channel's webhook right now: the instance answers the probe
 * with 204. A closed tunnel, a stopped dev server or an instance without `HOOKS_RELAY_SECRET` all
 * say no — and the relay keeps the account where it is instead of routing it into silence.
 */
export async function probeTarget(rt: Runtime, env: Environment, source: HookSourceId): Promise<boolean> {
  try {
    const response = await rt.fetch(targetUrl(rt, env, source, `?${RELAY_PROBE_QUERY}`), {
      redirect: "manual",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.status === 204;
  } catch {
    return false;
  }
}

export function targetUrl(rt: Runtime, env: Environment, source: HookSourceId, search = ""): string {
  return `${rt.config.targets[env].replace(/\/+$/, "")}${WEBHOOK_PATHS[source]}${search}`;
}

/** POSTs one delivery. The status, or 0 when the target could not be reached in time. */
export async function postDelivery(
  rt: Runtime,
  delivery: { env: Environment; source: HookSourceId; body: string; headers: Record<string, string> },
  timeoutMs = DELIVERY_TIMEOUT_MS,
): Promise<number> {
  try {
    const response = await rt.fetch(targetUrl(rt, delivery.env, delivery.source), {
      method: "POST",
      headers: delivery.headers,
      body: delivery.body,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.status;
  } catch {
    return 0;
  }
}

export type QueuedOutcome = "delivered" | "retry" | "dropped";

/**
 * What one attempt means. A refusal (4xx: a bad envelope, a missing secret) will not get better by
 * waiting, so it is dropped and logged; an unreachable or failing target is tried again later.
 */
function outcomeOf(status: number): QueuedOutcome {
  return status >= 200 && status < 300 ? "delivered" : status === 0 || status === 429 || status >= 500 ? "retry" : "dropped";
}

/**
 * A dev delivery, posted the moment Meta has its 200 (in `waitUntil`, so Meta never waits for a
 * tunnel). Only what could not be delivered goes to the queue. Dev is never re-routed to prod: a
 * closed tunnel waits in the queue, and `/env prod` is the way back.
 */
export async function deliverDirect(rt: Runtime, delivery: QueuedDelivery): Promise<QueuedOutcome> {
  let outcome: QueuedOutcome = "retry";
  for (let attempt = 1; attempt <= DIRECT_ATTEMPTS && outcome === "retry"; attempt++) {
    const started = rt.now();
    const status = await postDelivery(rt, delivery, DIRECT_TIMEOUT_MS);
    outcome = outcomeOf(status);
    rt.log("direct_delivery", { source: delivery.source, env: delivery.env, attempt, status, outcome, ms: rt.now() - started });
  }
  if (outcome === "retry") await enqueue(rt, delivery);
  return outcome;
}

/**
 * One delivery from the queue: a retry of what `deliverDirect` could not land. Retried with backoff
 * and, past the queue's `max_retries`, left in the dead-letter queue.
 */
export async function deliverQueued(rt: Runtime, delivery: QueuedDelivery): Promise<QueuedOutcome> {
  const started = rt.now();
  const status = await postDelivery(rt, delivery, QUEUED_TIMEOUT_MS);
  const outcome = outcomeOf(status);
  rt.log("queued_delivery", { source: delivery.source, env: delivery.env, status, outcome, ms: rt.now() - started });
  return outcome;
}

async function enqueue(rt: Runtime, delivery: QueuedDelivery): Promise<void> {
  if (delivery.body.length + JSON.stringify(delivery.headers).length > QUEUE_LIMIT_BYTES) {
    rt.log("oversized_delivery", { source: delivery.source, env: delivery.env });
    return;
  }
  try {
    await rt.queue.send(delivery);
  } catch (error) {
    rt.log("enqueue_failed", { source: delivery.source, env: delivery.env, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Seconds before the next try: 30 s, 1, 2, 4, 8 minutes — about a quarter of an hour in all. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(30 * 2 ** Math.max(attempts - 1, 0), 600);
}
