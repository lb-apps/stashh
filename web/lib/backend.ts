import "server-only";

/**
 * Server-side bridge to the Stashh backend.
 *
 * The backend sets `cors({ origin: false })` — it is built for the native iOS app
 * and rejects every browser origin. So the test console never calls it from the
 * client; these helpers run on the Next server, where CORS does not apply and the
 * dev access token stays out of the browser entirely.
 */

const BACKEND_URL = process.env.STASHH_API_URL ?? "http://localhost:3000";

export interface BackendCall<T> {
  /** Envelope payload, or null when the call failed before parsing. */
  data: T | null;
  /** Raw parsed body — surfaced verbatim in the console so failures stay debuggable. */
  raw: unknown;
  status: number;
  ok: boolean;
  /** Round-trip time measured on the server, in milliseconds. */
  durationMs: number;
  method: string;
  path: string;
  error: string | null;
}

/** Dev-only token endpoint. Cached so a poll loop doesn't re-authenticate every tick. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const res = await fetch(`${BACKEND_URL}/dev/token`, { cache: "no-store" });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.ok || !body?.data?.access_token) {
    throw new Error(
      body?.error?.message ??
        `Could not obtain a dev token from ${BACKEND_URL}/dev/token (HTTP ${res.status})`,
    );
  }

  cachedToken = {
    value: body.data.access_token,
    // Supabase access tokens last an hour; refresh well before the edge.
    expiresAt: Date.now() + 45 * 60 * 1000,
  };
  return cachedToken.value;
}

export async function callBackend<T>(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<BackendCall<T>> {
  const startedAt = performance.now();

  try {
    const token = await getAccessToken();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const raw = await res.json().catch(() => null);
    const durationMs = Math.round(performance.now() - startedAt);

    return {
      data: (raw?.data ?? null) as T | null,
      raw,
      status: res.status,
      ok: res.ok && raw?.ok !== false,
      durationMs,
      method,
      path,
      error: raw?.error?.message ?? (res.ok ? null : `HTTP ${res.status}`),
    };
  } catch (cause) {
    return {
      data: null,
      raw: null,
      status: 0,
      ok: false,
      durationMs: Math.round(performance.now() - startedAt),
      method,
      path,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}
