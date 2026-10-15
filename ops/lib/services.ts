import "server-only";
import type { OpsRange } from "./ops-types";

/**
 * Server-side access to the services' ops endpoints. URLs and tokens never reach the
 * browser: the dashboard's own route handlers call these and pass the JSON through.
 */

interface ServiceConfig {
  name: string;
  url: string;
  token: string;
}

function service(name: string, urlVar: string, tokenVar: string): ServiceConfig {
  const url = process.env[urlVar];
  const token = process.env[tokenVar];
  if (!url || !token) throw new OpsConfigError(`${name}: set ${urlVar} and ${tokenVar} in ops/.env.local`);
  return { name, url: url.replace(/\/$/, ""), token };
}

export class OpsConfigError extends Error {}

export class ServiceUnavailableError extends Error {
  constructor(
    readonly service: string,
    message: string,
  ) {
    super(message);
  }
}

async function getJson(config: ServiceConfig, path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      headers: { authorization: `Bearer ${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ServiceUnavailableError(config.name, `${config.name} is unreachable at ${config.url} (${(error as Error).message})`);
  }
  if (!response.ok) throw new ServiceUnavailableError(config.name, `${config.name} answered ${response.status}`);
  return response.json();
}

/** Backend: recognition ops snapshot (envelope `{ ok, data }`). */
export async function fetchRecognitionOps(range: OpsRange): Promise<unknown> {
  const body = (await getJson(service("Backend", "STASHH_API_URL", "STASHH_OPS_TOKEN"), `/internal/v1/ops/recognitions?range=${range}`)) as {
    data: unknown;
  };
  return body.data;
}

/** Instagram channel: DM ops snapshot. */
export async function fetchInstagramOps(range: OpsRange): Promise<unknown> {
  return getJson(service("Instagram", "INSTAGRAM_API_URL", "INSTAGRAM_OPS_TOKEN"), `/ops/stats?range=${range}`);
}

/* ── Recognition tester: the public API, as the backend's dev test user ─────────────── */

/** The backend refused the request itself (a bad link, an unknown id); the status and message are its own. */
export class BackendRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function backend(): { name: string; url: string } {
  const url = process.env["STASHH_API_URL"];
  if (!url) throw new OpsConfigError("Backend: set STASHH_API_URL in ops/.env.local");
  return { name: "Backend", url: url.replace(/\/$/, "") };
}

/** A Supabase token lives an hour; this is renewed a little before. */
const DEV_TOKEN_TTL_MS = 50 * 60_000;
let devToken: { token: string; expiresAt: number } | null = null;

/**
 * The backend's dev-only token for its test user (`GET /dev/token`, 404 in production).
 * The tester acts as that user, exactly as the old test page did, so a run from here is
 * indistinguishable from one the app sends.
 */
async function devBearer(): Promise<string> {
  if (devToken && devToken.expiresAt > Date.now()) return devToken.token;
  const { name, url } = backend();
  let response: Response;
  try {
    response = await fetch(`${url}/dev/token`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new ServiceUnavailableError(name, `${name} is unreachable at ${url} (${(error as Error).message})`);
  }
  const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: { access_token?: string }; error?: { message?: string } } | null;
  if (!response.ok || !body?.ok || !body.data?.access_token) {
    throw new ServiceUnavailableError(
      name,
      body?.error?.message ?? `${name} gave no dev token (${response.status}); set DEV_TEST_EMAIL and DEV_TEST_PASSWORD in backend/.env`,
    );
  }
  devToken = { token: body.data.access_token, expiresAt: Date.now() + DEV_TOKEN_TTL_MS };
  return devToken.token;
}

async function asTestUser(path: string, init: { method?: string; body?: string; bypassCache?: boolean } = {}): Promise<unknown> {
  const { name, url } = backend();
  const token = await devBearer();
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.bypassCache ? { "x-bypass-cache": "true" } : {}),
      },
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new ServiceUnavailableError(name, `${name} is unreachable at ${url} (${(error as Error).message})`);
  }
  // A refused token is forgotten, so the next call signs in again.
  if (response.status === 401) devToken = null;
  const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: unknown; error?: { message?: string } } | null;
  if (!response.ok || !body?.ok) throw new BackendRequestError(response.status, body?.error?.message ?? `${name} answered ${response.status}`);
  return body.data;
}

/** Enqueue a recognition for a link, as the app does; `bypassCache` makes the worker read the source again. */
export async function startRecognition(sourceUrl: string, bypassCache: boolean): Promise<unknown> {
  return asTestUser("/api/v1/recognitions", { method: "POST", body: JSON.stringify({ source_url: sourceUrl }), bypassCache });
}

/** The task's status and, once it has a result, its places. */
export async function fetchRecognitionStatus(id: string): Promise<unknown> {
  return asTestUser(`/api/v1/recognitions/${encodeURIComponent(id)}`);
}

/** Backend: one recognition in full; null when the backend has no such task. */
export async function fetchRecognitionDetail(id: string): Promise<unknown | null> {
  const config = service("Backend", "STASHH_API_URL", "STASHH_OPS_TOKEN");
  let response: Response;
  try {
    response = await fetch(`${config.url}/internal/v1/ops/recognitions/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${config.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new ServiceUnavailableError(config.name, `${config.name} is unreachable at ${config.url} (${(error as Error).message})`);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new ServiceUnavailableError(config.name, `${config.name} answered ${response.status}`);
  return ((await response.json()) as { data: unknown }).data;
}
