import { errorResponse } from "@/lib/ops-route";
import { findBillingPeople } from "@/lib/services";

/** `?q=`: part of an Instagram username, or a whole user id; the backend's own bounds. */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return Response.json({ error: "Search with 2 to 100 characters" }, { status: 400 });
  try {
    return Response.json(await findBillingPeople(query), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
