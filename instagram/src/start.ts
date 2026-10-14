import { loadConfig } from "./config.ts";
import { createApp } from "./http/app.ts";
import { createLogger } from "./lib/logger.ts";
import { CaptureSink } from "./webhooks/capture-sink.ts";

const config = loadConfig();
const log = createLogger(config);

if (!config.WEBHOOK_CAPTURE_DIR) {
  throw new Error("No webhook sink configured: set WEBHOOK_CAPTURE_DIR (development)");
}

const app = createApp({
  appSecret: config.INSTAGRAM_APP_SECRET,
  verifyToken: config.WEBHOOK_VERIFY_TOKEN,
  sink: new CaptureSink(config.WEBHOOK_CAPTURE_DIR, log),
  log,
});

const server = app.listen(config.PORT, () => {
  log.info({ port: config.PORT }, "instagram channel listening");
});

const shutdown = (signal: NodeJS.Signals) => {
  log.info({ signal }, "shutting down");
  server.close((error) => process.exit(error ? 1 : 0));
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
