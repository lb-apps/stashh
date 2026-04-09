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
  res.status(status).json(body);
}
