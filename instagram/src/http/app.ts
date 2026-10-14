import express, { type Express } from "express";
import type { Logger } from "../lib/logger.ts";
import { createOpsRouter, type OpsDeps } from "../ops/routes.ts";
import { createWebhookRouter, type WebhookSink } from "../webhooks/routes.ts";

export interface AppDeps {
  appSecret: string;
  verifyToken: string;
  sink: WebhookSink;
  log: Logger;
  /** Operator stats for the local ops dashboard; omitted (or tokenless) means no route. */
  ops?: OpsDeps;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/webhooks/instagram", createWebhookRouter(deps));
  if (deps.ops && deps.ops.tokens.length > 0) app.use("/ops", createOpsRouter(deps.ops));

  app.use((_req, res) => {
    res.sendStatus(404);
  });

  return app;
}
