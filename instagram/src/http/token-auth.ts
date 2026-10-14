import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Bearer-token guard for operator endpoints. Tokens are compared as SHA-256 digests
 * with `timingSafeEqual`, so neither length nor content leaks through timing. Several
 * tokens may be configured so one can be rotated without downtime.
 */
export function requireBearerToken(tokens: readonly string[]): RequestHandler {
  const accepted = tokens.map(digest);
  return (req, res, next) => {
    const header = req.get("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const candidate = digest(presented);
    // Check every token, so the time taken does not reveal which one matched.
    let ok = false;
    for (const token of accepted) ok = timingSafeEqual(candidate, token) || ok;
    if (presented && ok) {
      next();
      return;
    }
    res.sendStatus(401);
  };
}
