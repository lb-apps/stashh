import { createSupabaseClient } from "./storage/supabase.ts";
import { MenuRepository } from "./storage/repository.ts";
import { ImageStorage } from "./storage/images.ts";
import { createApp } from "./http/app.ts";
import { createDiscoverHandler, createStatusHandler, createRefreshHandler } from "./http/routes.ts";
import { MenuWorker } from "./worker/worker.ts";
import { createPipeline } from "./worker/pipeline.ts";
import { HttpClient } from "./lib/http-client.ts";
import { createLogger } from "./lib/logger.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig();
const log = createLogger(config);

const db = createSupabaseClient(config);
const repo = new MenuRepository(db);
const images = new ImageStorage(db, { maxWidth: config.IMAGE_MAX_WIDTH });
const httpClient = new HttpClient({ log: log.child({ component: "http" }) });

const pipeline = createPipeline({ config, repo, images, httpClient, log });

const worker = new MenuWorker({
  repo,
  process: pipeline,
  concurrency: config.MENU_WORKER_CONCURRENCY,
  log: log.child({ component: "worker" }),
});

const app = createApp({
  internalTokens: config.INTERNAL_API_TOKENS,
  log,
  discoverHandler: createDiscoverHandler(repo, log),
  statusHandler: createStatusHandler(repo),
  refreshHandler: createRefreshHandler(repo, log),
});

const server = app.listen(config.PORT, () => {
  log.info({ port: config.PORT }, "menu discovery service listening");
});
worker.start();

const shutdown = async (signal: NodeJS.Signals) => {
  log.info({ signal }, "shutting down");
  server.close();
  await worker.stop();
  process.exit(0);
};
process.once("SIGTERM", (signal) => void shutdown(signal));
process.once("SIGINT", (signal) => void shutdown(signal));
