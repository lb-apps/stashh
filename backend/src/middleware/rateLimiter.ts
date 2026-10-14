import rateLimit from "express-rate-limit";
import { sendError } from "../http/response.js";

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  // requireAuth always runs first, so req.user.sub is always defined here
  keyGenerator: (req) => req.user?.sub ?? "unknown",
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, req, 429, "RATE_LIMIT", "Too many requests, please slow down");
  },
});

/**
 * Ceiling for the internal API. Callers are trusted services, so this guards against a
 * runaway client loop rather than abuse; it is keyed by IP because there is no user.
 */
export const internalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(res, req, 429, "RATE_LIMIT", "Too many requests, please slow down");
  },
});
