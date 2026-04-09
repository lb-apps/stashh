import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      /** Set by {@link requestIdMiddleware}; stable for the whole request. */
      requestId?: string;
    }
  }
}

/**
 * Ensures every request has a `requestId` (from `X-Request-Id` or generated)
 * and echoes it on the response for tracing.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fromHeader = req.headers["x-request-id"];
  const id =
    typeof fromHeader === "string" && fromHeader.trim().length > 0 ? fromHeader.trim() : randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

export function getRequestId(req: Request): string {
  return req.requestId ?? randomUUID();
}
