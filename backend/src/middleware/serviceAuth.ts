import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { sendError } from "../http/response.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by {@link createServiceAuth} once a service token is verified. */
      servicePrincipal?: { kind: "service" };
    }
  }
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Authenticates service-to-service calls on `/internal/v1` with a static bearer token.
 *
 * Tokens are compared as SHA-256 digests with `timingSafeEqual`, so neither the length
 * nor the content of a configured token leaks through response timing. Several tokens
 * may be configured at once to rotate without downtime. This is deliberately a separate
 * credential from user JWTs: a user token never opens internal routes and a service
 * token never opens user routes.
 */
export function createServiceAuth(tokens: readonly string[]): RequestHandler {
  const accepted = tokens.map(digest);

  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      sendError(res, req, 401, "UNAUTHORIZED", "Missing or malformed Authorization header");
      return;
    }

    const presented = digest(header.slice("Bearer ".length));
    // Check every token so the comparison count does not depend on which one matches.
    const matched = accepted.reduce((hit, token) => timingSafeEqual(token, presented) || hit, false);
    if (!matched) {
      sendError(res, req, 401, "UNAUTHORIZED", "Invalid service token");
      return;
    }

    req.servicePrincipal = { kind: "service" };
    next();
  };
}
