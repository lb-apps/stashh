import type { Request, Response, NextFunction } from "express";
import { respondToError } from "../errors/respondToError.js";
import { getRequestId } from "../http/requestId.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    console.error("[errorHandler] headers already sent", err);
    return;
  }
  console.error(err);
  const { status, body } = respondToError(err, getRequestId(req));
  // The real cause for the ops dashboard's recent-errors list; the client sees `body` only.
  if (status >= 500) res.locals.errorMessage = err instanceof Error ? err.message : String(err);
  res.status(status).json(body);
}
