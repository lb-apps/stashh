import "server-only";
import { OPS_RANGES, type OpsRange } from "./ops-types";
import { OpsConfigError, ServiceUnavailableError } from "./services";

/** Shared GET handler: validate `?range`, call the service, map failures to readable errors. */
export function opsRoute(load: (range: OpsRange) => Promise<unknown>) {
  return async function GET(request: Request): Promise<Response> {
    const range = new URL(request.url).searchParams.get("range") ?? "24h";
    if (!(OPS_RANGES as readonly string[]).includes(range)) {
      return Response.json({ error: "range must be one of 24h, 7d, 30d" }, { status: 400 });
    }
    try {
      return Response.json(await load(range as OpsRange), { headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (error instanceof ServiceUnavailableError) return Response.json({ error: error.message }, { status: 502 });
      if (error instanceof OpsConfigError) return Response.json({ error: error.message }, { status: 500 });
      throw error;
    }
  };
}
