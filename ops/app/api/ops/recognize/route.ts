import { errorResponse } from "@/lib/ops-route";
import { startRecognition } from "@/lib/services";

/** Start one recognition for a link, as the backend's test user. */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { source_url?: unknown; bypass_cache?: unknown } | null;
  const sourceUrl = typeof body?.source_url === "string" ? body.source_url.trim() : "";
  if (!sourceUrl) return Response.json({ error: "source_url is required" }, { status: 400 });
  try {
    return Response.json(await startRecognition(sourceUrl, body?.bypass_cache === true), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
