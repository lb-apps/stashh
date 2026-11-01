import { isEnvironment, type Environment } from "../../../instagram/src/webhooks/core/environments.ts";
import type { RouteStore } from "./runtime.ts";

/**
 * Where each sender is routed, in KV. Keys are the source's sender key (`instagram:<IGSID>`).
 * Nothing expires: a route holds until `/env prod`, which deletes it, so the store only ever lists
 * the accounts that are away from prod.
 *
 *   route:<key>  {"env": "dev", "at": "<ISO>"}
 */
export function routeStore(store: RouteStore, defaultEnv: Environment, now: () => number) {
  return {
    async envOf(key: string): Promise<Environment> {
      const raw = await store.get(`route:${key}`);
      if (!raw) return defaultEnv;
      try {
        const value: unknown = JSON.parse(raw);
        const env = typeof value === "object" && value !== null ? (value as { env?: unknown }).env : null;
        return isEnvironment(env) ? env : defaultEnv;
      } catch {
        return defaultEnv;
      }
    },

    async setEnv(key: string, env: Environment): Promise<void> {
      if (env === defaultEnv) await store.delete(`route:${key}`);
      else await store.put(`route:${key}`, JSON.stringify({ env, at: new Date(now()).toISOString() }));
    },
  };
}

export type Routes = ReturnType<typeof routeStore>;
