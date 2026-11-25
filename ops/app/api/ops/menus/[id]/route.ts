import { fetchMenuDetail } from "@/lib/services";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, ctx: RouteContext<"/api/ops/menus/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "id must be a UUID" }, { status: 400 });
  try {
    const detail = await fetchMenuDetail(id);
    if (!detail) return Response.json({ error: "Menu not found" }, { status: 404 });
    return Response.json(detail, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Menus service unavailable" }, { status: 502 });
  }
}
