import type { Request, Response } from "express";
import type { ApiMeta, ApiPaginationMeta, ApiSuccessEnvelope } from "./types.js";
import { getRequestId } from "./requestId.js";

function meta(req: Request, pagination: ApiPaginationMeta | null): ApiMeta {
  return {
    request_id: getRequestId(req),
    pagination,
  };
}

export function sendSuccess<T>(
  res: Response,
  req: Request,
  status: number,
  data: T,
  pagination: ApiPaginationMeta | null = null,
): void {
  const body: ApiSuccessEnvelope<T> = {
    ok: true,
    data,
    meta: meta(req, pagination),
    error: null,
  };
  res.status(status).json(body);
}

export function sendCreated<T>(res: Response, req: Request, data: T): void {
  sendSuccess(res, req, 201, data, null);
}

export function sendAccepted<T>(res: Response, req: Request, data: T): void {
  sendSuccess(res, req, 202, data, null);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Client-facing validation / auth errors returned directly from route handlers
 * (without throwing). Uses the same envelope as {@link respondToError}.
 */
export function sendError(
  res: Response,
  req: Request,
  status: number,
  code: string,
  message: string,
  details: unknown = null,
): void {
  res.status(status).json({
    ok: false,
    data: null,
    meta: meta(req, null),
    error: {
      code,
      message,
      details,
    },
  });
}
