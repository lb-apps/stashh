import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { userListsRouter } from "./modules/user-lists/routes.js";
import { placesRouter } from "./modules/places/routes.js";
import { userPlacesRouter } from "./modules/user-places/routes.js";
import { recognitionsRouter } from "./modules/recognitions/routes.js";
import { listLogFiles, readLogFile } from "./logger.js";
import { requireAuth } from "./middleware/auth.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestIdMiddleware } from "./http/requestId.js";
import { sendSuccess, sendError } from "./http/response.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

let server: http.Server | null = null;
let apiShutdownHandlersRegistered = false;

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === resolve(fileURLToPath(import.meta.url));
}

function registerApiShutdownHandlers(): void {
  if (process.env["APP_ROLE"]?.toLowerCase() === "combined") {
    return;
  }
  if (apiShutdownHandlersRegistered) return;
  apiShutdownHandlersRegistered = true;

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

/** Starts the HTTP server idempotently. */
export function startHttpServer(): http.Server {
  if (server) {
    return server;
  }
  registerApiShutdownHandlers();
  server = app.listen(config.PORT, () => {
    console.log(`Discovery API running on http://localhost:${config.PORT}`);
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
app.use(express.static(resolve(__dirname, "../public")));

// Dev-only: return a fresh Supabase access token for the test UI
// Returns 404 in production
app.get("/dev/token", async (req, res) => {
  if (process.env["NODE_ENV"] === "production") {
    sendError(res, req, 404, "NOT_FOUND", "Not found");
    return;
  }

  const { SUPABASE_URL, supabasePublishableKey, DEV_TEST_EMAIL, DEV_TEST_PASSWORD } = config;

  if (!supabasePublishableKey || !DEV_TEST_EMAIL || !DEV_TEST_PASSWORD) {
    sendError(
      res,
      req,
      503,
      "SERVICE_UNAVAILABLE",
      "DEV_TEST_EMAIL, DEV_TEST_PASSWORD, and SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY) must be set in .env",
    );
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: supabasePublishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: DEV_TEST_EMAIL, password: DEV_TEST_PASSWORD }),
      },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      sendError(
        res,
        req,
        response.status >= 400 && response.status < 600 ? response.status : 401,
        "UNAUTHORIZED",
        (body["error_description"] as string | undefined) ?? "Supabase auth failed",
      );
      return;
    }

    const data = (await response.json()) as { access_token: string };
    sendSuccess(res, req, 200, {
      access_token: data.access_token,
      supabase_url: SUPABASE_URL,
      supabase_publishable_key: supabasePublishableKey,
    });
  } catch (err) {
    console.error("[dev/token]", err);
    sendError(res, req, 500, "INTERNAL", "Authentication request failed");
  }
});

// Health check — intentionally unprotected (for uptime probes)
app.get("/health", (req, res) => {
  sendSuccess(res, req, 200, { status: "ok", timestamp: new Date().toISOString() });
});

// ── Logs (protected) ──────────────────────────────────────────────────────────

app.get("/api/v1/logs", requireAuth, async (req, res, next) => {
  try {
    const files = await listLogFiles();
    sendSuccess(res, req, 200, { count: files.length, files });
  } catch (err) {
    next(err);
  }
});

app.get("/api/v1/logs/latest", requireAuth, async (req, res, next) => {
  try {
    const files = await listLogFiles();
    if (!files.length) {
      sendError(res, req, 404, "NOT_FOUND", "No logs yet");
      return;
    }
    sendSuccess(res, req, 200, await readLogFile(files[0]!));
  } catch (err) {
    next(err);
  }
});

app.get("/api/v1/logs/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params["id"] ?? "");
    const filename = id.endsWith(".jsonl") ? id : `${id}.jsonl`;
    sendSuccess(res, req, 200, await readLogFile(filename));
  } catch {
    sendError(res, req, 404, "NOT_FOUND", "Log not found");
  }
});

// ── Lists (protected + rate limited) ────────────────────────────────────────

app.use("/api/v1/user-lists", requireAuth, apiRateLimiter, userListsRouter);

// ── Places catalog (protected + rate limited) ──────────────────────────────

app.use("/api/v1/places", requireAuth, apiRateLimiter, placesRouter);

// ── User places / saved venues (protected + rate limited) ────────────────────

app.use("/api/v1/user-places", requireAuth, apiRateLimiter, userPlacesRouter);

// ── Recognitions (protected + rate limited) ──────────────────────────────────

app.use("/api/v1/recognitions", requireAuth, apiRateLimiter, recognitionsRouter);

app.use(errorHandler);

if (isMainModule()) {
  startHttpServer();
}

export { app };
