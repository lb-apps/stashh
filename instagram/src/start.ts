import { createAnalytics } from "./analytics/mixpanel.ts";
import { loadConfig } from "./config.ts";
import { outboundMode } from "./conversation/outbound.ts";
import { MessageProcessor } from "./conversation/processor.ts";
import { MessageWorker } from "./conversation/worker.ts";
import { createDb } from "./db/client.ts";
import { SupabaseMessageStore } from "./db/message-store.ts";
import { createApp } from "./http/app.ts";
import { createOpsSnapshot } from "./ops/snapshot.ts";
import { createLogger } from "./lib/logger.ts";
import { InstagramMessenger, InstagramProfiles } from "./meta/graph-client.ts";
import { InstagramTokenStore } from "./meta/token-store.ts";
import { sweepProfiles } from "./profiles/sweep.ts";
import { HttpStashhApi } from "./stashh/client.ts";
import { CaptureSink } from "./webhooks/capture-sink.ts";
import type { WebhookSink } from "./webhooks/routes.ts";
import { createWebhookCounters } from "./webhooks/counters.ts";
import { instanceEnvironment } from "./webhooks/relay.ts";
import { FanOutSink, StoreSink } from "./webhooks/store-sink.ts";

const HOUR_MS = 60 * 60 * 1000;
/** Privacy policy: messages are kept for 30 days. */
const MESSAGE_RETENTION_MS = 30 * 24 * HOUR_MS;

const config = loadConfig();
const log = createLogger(config);

// Which environment this instance is to the hooks relay, and whom it may write to (docs/webhook-relay.md).
const environment = instanceEnvironment(config.NODE_ENV);
const outbound = outboundMode(environment, config.META_OUTBOUND);
log.info(
  { environment, outbound, relay: Boolean(config.HOOKS_RELAY_SECRET), analytics: Boolean(config.MIXPANEL_TOKEN) },
  "instagram channel environment",
);

// Product events carry `app_env` in the web's words, so both interfaces read the same in Mixpanel.
const analytics = createAnalytics({
  token: config.MIXPANEL_TOKEN,
  appEnv: environment === "prod" ? "production" : "development",
  log: log.child({ component: "analytics" }),
});

const db = createDb({ url: config.SUPABASE_URL, secretKey: config.SUPABASE_SECRET_KEY });
const store = new SupabaseMessageStore(db, { environment });
const tokens = new InstagramTokenStore({
  db,
  accountId: config.INSTAGRAM_ACCOUNT_ID,
  bootstrapToken: config.INSTAGRAM_ACCESS_TOKEN,
  log: log.child({ component: "tokens" }),
});
const stashh = new HttpStashhApi({ baseUrl: config.STASHH_API_URL, token: config.STASHH_API_TOKEN });
const profiles = new InstagramProfiles({ apiVersion: config.GRAPH_API_VERSION, tokens });
const processor = new MessageProcessor({
  store,
  stashh,
  messenger: new InstagramMessenger({ apiVersion: config.GRAPH_API_VERSION, tokens }),
  profiles,
  log: log.child({ component: "processor" }),
  outbound,
  suggestedReplies: config.RECOGNITION_SUGGESTED_REPLIES === "on",
  analytics,
});
const worker = new MessageWorker({
  store,
  process: (message) => processor.process(message),
  concurrency: config.WORKER_CONCURRENCY,
  log: log.child({ component: "worker" }),
});

const webhookCounters = createWebhookCounters();
const sinks: WebhookSink[] = [
  new StoreSink({ store, accountId: config.INSTAGRAM_ACCOUNT_ID, environment, log, counters: webhookCounters }),
];
if (config.WEBHOOK_CAPTURE_DIR) sinks.push(new CaptureSink(config.WEBHOOK_CAPTURE_DIR, log));

const app = createApp({
  appSecret: config.INSTAGRAM_APP_SECRET,
  verifyToken: config.WEBHOOK_VERIFY_TOKEN,
  relaySecret: config.HOOKS_RELAY_SECRET,
  sink: sinks.length === 1 ? sinks[0]! : new FanOutSink(sinks),
  log,
  counters: webhookCounters,
  ops: {
    tokens: config.OPS_API_TOKENS,
    snapshot: createOpsSnapshot({ db, inFlight: () => worker.inFlightCount, startedAt: new Date(), webhooks: webhookCounters }),
  },
});

// Fail fast on a missing or unreadable token rather than on the first reply.
await tokens.accessToken();

const server = app.listen(config.PORT, () => {
  log.info({ port: config.PORT }, "instagram channel listening");
});
worker.start();

const maintenance = async () => {
  await tokens.refreshIfDue().catch((error: unknown) => log.error({ err: error }, "token refresh check failed"));
  await store
    .purgeCreatedBefore(new Date(Date.now() - MESSAGE_RETENTION_MS))
    .then((removed) => removed > 0 && log.info({ removed }, "expired messages purged"))
    .catch((error: unknown) => log.error({ err: error }, "message purge failed"));
};
void maintenance();
const maintenanceTimer = setInterval(() => void maintenance(), HOUR_MS);

const profileLog = log.child({ component: "profiles" });
const profileSweep = () =>
  sweepProfiles({ stashh, profiles, log: profileLog })
    .then((stored) => stored > 0 && profileLog.info({ stored }, "profiles refreshed"))
    .catch((error: unknown) => profileLog.error({ err: error }, "profile sweep failed"));
void profileSweep();
const profileTimer = setInterval(() => void profileSweep(), 24 * HOUR_MS);

const shutdown = async (signal: NodeJS.Signals) => {
  log.info({ signal }, "shutting down");
  clearInterval(maintenanceTimer);
  clearInterval(profileTimer);
  server.close();
  await worker.stop();
  await analytics.flush();
  process.exit(0);
};
process.once("SIGTERM", (signal) => void shutdown(signal));
process.once("SIGINT", (signal) => void shutdown(signal));
