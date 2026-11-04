import { parseEnvironment } from "../../../instagram/src/webhooks/core/environments.ts";
import { deliverQueued, retryDelaySeconds } from "./deliver.ts";
import { handleRequest } from "./handle.ts";
import type { HooksConfig, QueuedDelivery, Runtime } from "./runtime.ts";

function config(env: Env): HooksConfig {
  return {
    defaultEnv: parseEnvironment(env.DEFAULT_ENV) ?? "prod",
    targets: { prod: env.PROD_URL, dev: env.DEV_URL },
    secrets: { instagram: env.INSTAGRAM_APP_SECRET ?? "" },
    relaySecret: env.HOOKS_RELAY_SECRET,
  };
}

function runtime(env: Env, ctx: ExecutionContext): Runtime {
  return {
    config: config(env),
    routes: env.ROUTES,
    queue: {
      send: async (delivery) => {
        await env.DELIVERIES.send(delivery);
      },
    },
    fetch: (input, init) => fetch(input, init),
    waitUntil: (promise) => ctx.waitUntil(promise),
    now: () => Date.now(),
    log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
  };
}

export default {
  fetch(request, env, ctx): Promise<Response> {
    return handleRequest(request, runtime(env, ctx));
  },

  async queue(batch, env, ctx): Promise<void> {
    const rt = runtime(env, ctx);
    for (const message of batch.messages) {
      const outcome = await deliverQueued(rt, message.body);
      if (outcome === "retry") message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
      else message.ack();
    }
  },
} satisfies ExportedHandler<Env, QueuedDelivery>;
