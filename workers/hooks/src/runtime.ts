import type { Environment } from "../../../instagram/src/webhooks/core/environments.ts";
import type { HookSourceId } from "../../../instagram/src/webhooks/core/sources/index.ts";

/**
 * Everything the relay needs from outside: configuration, the route store, the queue, the network
 * and the clock. `index.ts` wires Cloudflare's; tests pass fakes, so the whole pipeline runs in
 * Vitest.
 */
export interface HooksConfig {
  /** Where a sender with no route goes. `prod` in production. */
  defaultEnv: Environment;
  /** Each environment's origin; the path is the source's webhook path (`/webhooks` for Instagram). */
  targets: Record<Environment, string>;
  /** The app secret each provider signs its webhooks with (Instagram: the Instagram app's). */
  secrets: Record<HookSourceId, string>;
  /** Seals the envelope; the same value as every instance's `HOOKS_RELAY_SECRET`. */
  relaySecret: string;
}

/** The KV namespace, as far as the relay uses it. */
export interface RouteStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** A delivery to dev, waiting in the queue: exactly the request the instance will receive. */
export interface QueuedDelivery {
  env: Environment;
  source: HookSourceId;
  body: string;
  headers: Record<string, string>;
}

export interface DeliveryQueue {
  send(delivery: QueuedDelivery): Promise<void>;
}

export interface Runtime {
  config: HooksConfig;
  routes: RouteStore;
  queue: DeliveryQueue;
  fetch: typeof fetch;
  waitUntil(promise: Promise<unknown>): void;
  now(): number;
  /** One JSON line per event. Never pass a body, a sender id or an IP. */
  log(event: string, fields?: Record<string, unknown>): void;
}
