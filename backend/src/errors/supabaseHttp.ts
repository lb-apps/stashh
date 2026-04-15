import type { PostgrestError } from "@supabase/supabase-js";

interface SupabaseHttpResponse {
  status: number;
  body: { error: string; error_code: string };
}

export function isPostgrestError(value: unknown): value is PostgrestError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as PostgrestError;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

/**
 * Maps Supabase PostgREST errors to HTTP responses (no internal detail leakage).
 */
export function mapSupabaseErrorToHttp(error: unknown): SupabaseHttpResponse {
  if (!isPostgrestError(error)) {
    return { status: 500, body: { error: "Unexpected error", error_code: "INTERNAL" } };
  }

  const code = error.code;

  if (code === "PGRST116" || code === "22P02") {
    return { status: 400, body: { error: "Invalid request", error_code: "BAD_REQUEST" } };
  }

  if (code === "23505") {
    return { status: 409, body: { error: "Conflict", error_code: "CONFLICT" } };
  }

  if (code === "42501" || code === "PGRST301") {
    return { status: 403, body: { error: "Forbidden", error_code: "FORBIDDEN" } };
  }

  if (code === "23503") {
    return { status: 400, body: { error: "Invalid reference", error_code: "BAD_REQUEST" } };
  }

  return { status: 500, body: { error: "Request failed", error_code: "INTERNAL" } };
}
