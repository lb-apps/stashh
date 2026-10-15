import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { listsRouter } from "./modules/lists/routes.js";
import { libraryRouter } from "./modules/library/routes.js";
import { placesRouter } from "./modules/places/routes.js";
import { recognitionsRouter } from "./modules/recognitions/routes.js";
import { rootLogger } from "./lib/logger.js";
import { requireAuth } from "./middleware/auth.js";
import { apiRateLimiter, internalRateLimiter } from "./middleware/rateLimiter.js";
import { createServiceAuth } from "./middleware/serviceAuth.js";
import { internalRouter } from "./modules/internal/routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdMiddleware } from "./http/requestId.js";
import { apiMetrics, apiMetricsMiddleware } from "./lib/api-metrics.js";
import { sendSuccess, sendError } from "./http/response.js";
import { mountDocs } from "./docs.js";
import { signInDevTestUser } from "./lib/devSupabasePasswordSignIn.js";

const app = express();

let server: http.Server | null = null;

/** Starts the HTTP server idempotently. */
export function startHttpServer(): http.Server {
  if (server) {
    return server;
  }
  server = app.listen(config.PORT, () => {
    rootLogger.info({ port: config.PORT }, "Stashh API started");
  });
  return server;
}

/** Stops accepting new connections; waits for existing connections to finish. */
export async function closeHttpServer(): Promise<void> {
  if (!server) return;
  const listening = server;
  server = null;
  await new Promise<void>((resolve, reject) => {
    listening.close((err) => (err ? reject(err) : resolve()));
  });
}

// Block all cross-origin web requests — this API is for the native iOS app only
app.use(cors({ origin: false }));
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(express.json({ limit: "512kb" }));
app.use(requestIdMiddleware);
// API health for the ops dashboard; its own polling, health checks and docs are not traffic.
app.use(apiMetricsMiddleware(apiMetrics, (path) => /^\/(internal\/v1\/ops|health|docs|openapi)/.test(path)));

// Dev-only: a fresh Supabase access token for the test user, which the ops dashboard's
// link tester (ops/, "Recognize a link") uses to act as the app would. 404 in production.
app.get("/dev/token", async (req, res) => {
  const result = await signInDevTestUser();
  if (!result.ok) {
    if (result.error === "production") {
      sendError(res, req, 404, "NOT_FOUND", "Not found");
      return;
    }
    if (result.error === "missing_env") {
      sendError(
        res,
        req,
        503,
        "SERVICE_UNAVAILABLE",
        "DEV_TEST_EMAIL, DEV_TEST_PASSWORD, and SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY) must be set in .env",
      );
      return;
    }
    sendError(
      res,
      req,
      result.httpStatus ?? 401,
      "UNAUTHORIZED",
      result.message ?? "Supabase auth failed",
    );
    return;
  }

  sendSuccess(res, req, 200, {
    access_token: result.access_token,
    supabase_url: config.SUPABASE_URL,
    supabase_publishable_key: config.supabasePublishableKey,
    /** Same identity as password grant — UI can label saved places. */
    dev_user_email: config.DEV_TEST_EMAIL ?? null,
  });
});

// Health check — intentionally unprotected (for uptime probes)
app.get("/health", (req, res) => {
  sendSuccess(res, req, 200, { status: "ok", timestamp: new Date().toISOString() });
});

// ── Lists (protected + rate limited) ────────────────────────────────────────

app.use("/api/v1/lists", requireAuth, apiRateLimiter, listsRouter);

// ── Library summary (protected + rate limited) ─────────────────────────────

app.use("/api/v1/library", requireAuth, apiRateLimiter, libraryRouter);

// ── Places catalog (protected + rate limited) ──────────────────────────────

app.use("/api/v1/places", requireAuth, apiRateLimiter, placesRouter);

// ── Recognitions (protected + rate limited) ──────────────────────────────────

app.use("/api/v1/recognitions", requireAuth, apiRateLimiter, recognitionsRouter);

// ── Internal API (service-to-service; service token, never user JWTs) ───────

if (config.INTERNAL_API_TOKENS.length > 0) {
  app.use("/internal/v1", createServiceAuth(config.INTERNAL_API_TOKENS), internalRateLimiter, internalRouter);
} else {
  rootLogger.info("internal API disabled — INTERNAL_API_TOKENS not set");
}

await mountDocs(app);

app.use(errorHandler);

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === resolve(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  startHttpServer();

  let closing = false;
  const onSignal = () => {
    if (closing) return;
    closing = true;
    void closeHttpServer()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
}

export { app };
