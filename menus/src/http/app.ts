import express from "express";
import type { Logger } from "../lib/logger.ts";

export interface AppOptions {
  internalTokens: string[];
  log: Logger;
  discoverHandler: express.RequestHandler;
  statusHandler: express.RequestHandler;
  refreshHandler: express.RequestHandler;
  opsMenusHandler: express.RequestHandler;
  opsMenuDetailHandler: express.RequestHandler;
}

export function createApp(options: AppOptions) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const auth: express.RequestHandler = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ ok: false, error: "missing token" });
      return;
    }
    const token = header.slice(7);
    if (!options.internalTokens.includes(token)) {
      res.status(403).json({ ok: false, error: "invalid token" });
      return;
    }
    next();
  };

  app.post("/internal/v1/discover", auth, options.discoverHandler);
  app.get("/internal/v1/status/:menuId", auth, options.statusHandler);
  app.post("/internal/v1/refresh/:placeId", auth, options.refreshHandler);
  app.get("/internal/v1/ops/menus", auth, options.opsMenusHandler);
  app.get("/internal/v1/ops/menus/:menuId", auth, options.opsMenuDetailHandler);

  app.use(((err: Error, _req, res, _next) => {
    options.log.error({ err }, "unhandled error");
    res.status(500).json({ ok: false, error: "internal error" });
  }) as express.ErrorRequestHandler);

  return app;
}
