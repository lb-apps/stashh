import { isAppHttpError } from "./appHttpError.js";
import { isPostgrestError, mapSupabaseErrorToHttp } from "./supabaseHttp.js";

export function respondToError(
  error: unknown,
  requestId: string,
): { status: number; body: Record<string, unknown> } {
  if (isAppHttpError(error)) {
    return {
      status: error.status,
      body: {
        ok: false,
        data: null,
        meta: { request_id: requestId, pagination: null },
        error: {
          code: error.errorCode,
          message: error.message,
          details: error.details ?? null,
        },
      },
    };
  }
  if (isPostgrestError(error)) {
    const mapped = mapSupabaseErrorToHttp(error);
    return {
      status: mapped.status,
      body: {
        ok: false,
        data: null,
        meta: { request_id: requestId, pagination: null },
        error: {
          code: mapped.body.error_code,
          message: mapped.body.error,
          details: null,
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      data: null,
      meta: { request_id: requestId, pagination: null },
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        details: null,
      },
    },
  };
}
