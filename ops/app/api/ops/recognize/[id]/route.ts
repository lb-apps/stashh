import { errorResponse } from "@/lib/ops-route";
import { fetchRecognitionStatus } from "@/lib/services";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One recognition's status and places, as the backend's test user sees them. */
export async function GET(_request: Request, ctx: RouteContext<"/api/ops/recognize/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "id must be a UUID" }, { status: 400 });
  try {
    return Response.json(await fetchRecognitionStatus(id), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
