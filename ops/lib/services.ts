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
