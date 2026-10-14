import { OpsConfigError, ServiceUnavailableError, fetchRecognitionDetail } from "@/lib/services";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, ctx: RouteContext<"/api/ops/recognitions/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "id must be a UUID" }, { status: 400 });
  try {
    const detail = await fetchRecognitionDetail(id);
    if (!detail) return Response.json({ error: "Tanıma bulunamadı" }, { status: 404 });
    return Response.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return Response.json({ error: error.message }, { status: 502 });
    if (error instanceof OpsConfigError) return Response.json({ error: error.message }, { status: 500 });
    throw error;
  }
}
