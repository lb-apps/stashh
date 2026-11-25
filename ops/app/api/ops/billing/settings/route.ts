import { errorResponse } from "@/lib/ops-route";
import { fetchBillingSettings, updateBillingSettings } from "@/lib/services";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await fetchBillingSettings(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

/** The owner's change, passed to the backend as is; the backend validates and answers with the settings after it. */
export async function PUT(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) return Response.json({ error: "Nothing to change" }, { status: 400 });
  try {
    return Response.json(await updateBillingSettings(body), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
