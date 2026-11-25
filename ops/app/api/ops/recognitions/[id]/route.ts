import { OpsConfigError, ServiceUnavailableError, fetchRecognitionDetail, fetchMenusForPlaces } from "@/lib/services";
import type { RecognitionDetail } from "@/lib/ops-types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, ctx: RouteContext<"/api/ops/recognitions/[id]">): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "id must be a UUID" }, { status: 400 });
  try {
    const detail = (await fetchRecognitionDetail(id)) as RecognitionDetail | null;
    if (!detail) return Response.json({ error: "Recognition not found" }, { status: 404 });

    const googlePlaceIds = detail.places.map((p) => p.google_place_id).filter(Boolean);
    if (googlePlaceIds.length > 0) {
      try {
        detail.menus = (await fetchMenusForPlaces(googlePlaceIds)) as RecognitionDetail["menus"];
      } catch {
        // Menu data is optional; the detail still renders without it.
      }
    }

    return Response.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return Response.json({ error: error.message }, { status: 502 });
    if (error instanceof OpsConfigError) return Response.json({ error: error.message }, { status: 500 });
    throw error;
  }
}
