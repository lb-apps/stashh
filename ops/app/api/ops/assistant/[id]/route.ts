import { errorResponse } from "@/lib/ops-route";
import { fetchAssistantTurn } from "@/lib/services";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, ctx: RouteContext<"/api/ops/assistant/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "id must be a UUID" }, { status: 400 });
  try {
    const detail = await fetchAssistantTurn(id);
    if (!detail) return Response.json({ error: "Assistant turn not found" }, { status: 404 });
    return Response.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
