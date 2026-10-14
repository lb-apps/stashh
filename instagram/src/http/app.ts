import express, { type Express } from "express";
import type { Logger } from "../lib/logger.ts";
import { createWebhookRouter, type WebhookSink } from "../webhooks/routes.ts";

export interface AppDeps {
  appSecret: string;
  verifyToken: string;
  sink: WebhookSink;
  log: Logger;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/webhooks/instagram", createWebhookRouter(deps));

  app.use((_req, res) => {
    res.sendStatus(404);
  });

  return app;
}
