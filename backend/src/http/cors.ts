import cors from "cors";
import type { RequestHandler } from "express";

/**
 * CORS for the web app, which calls the API straight from the browser.
 *
 * Only the listed origins are answered with CORS headers; any other origin gets none and
 * the browser blocks the response. Requests without an `Origin` (the iOS app, the DM
 * service, curl) are not affected. Auth is a bearer token, never a cookie, so credentials
 * stay off.
 */
export function createCors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    maxAge: 86_400,
  });
}
