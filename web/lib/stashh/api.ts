import { supabase } from "../auth/supabase";
import { publicEnv } from "../env";
import type { Envelope } from "./types";

/**
 * Typed failure of an API call. `code` is the backend's error code
 * (`not_found`, `unauthorized`, …) or `network` when no response arrived.
 */
export class StashhApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StashhApiError";
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

/**
 * One request to `/api/v1`, authenticated with the signed-in user's Supabase
 * JWT and unwrapped from the `{ ok, data, meta, error }` envelope. The browser
 * calls the backend directly (CORS allowlist), with no proxy hop.
 */
export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  return (await requestEnvelope<T>(method, path, options)).data as T;
}

type Pagination = NonNullable<NonNullable<Envelope<unknown>["meta"]>["pagination"]>;

/**
 * Every page of a cursor-paginated collection (`{ items }` + `meta.pagination`),
 * concatenated. For the user's own library, which is small enough to hold whole.
 */
export async function requestAll<T>(path: string, options: Omit<RequestOptions, "body"> = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const envelope = await requestEnvelope<{ items: T[] }>("GET", path, {
      ...options,
      query: { ...options.query, limit: 100, cursor },
    });
    items.push(...(envelope.data?.items ?? []));
    const pagination: Pagination | null | undefined = envelope.meta?.pagination;
    cursor = pagination?.has_more ? (pagination.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return items;
}

async function requestEnvelope<T>(method: Method, path: string, options: RequestOptions): Promise<Envelope<T>> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StashhApiError("unauthorized", "Not signed in", 401);

  const url = new URL(`/api/v1${path}`, publicEnv.apiUrl);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: options.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new StashhApiError("network", "No connection", 0);
  }

  if (response.status === 204) return { ok: true, data: null, meta: null, error: null };

  const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !envelope?.ok) {
    throw new StashhApiError(
      envelope?.error?.code ?? "http_error",
      envelope?.error?.message ?? `HTTP ${response.status}`,
      response.status,
    );
  }
  return envelope;
}
