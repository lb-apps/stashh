import { errorResponse } from "@/lib/ops-route";
import { setPlan } from "@/lib/services";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `{ plan, expires_at? }`, passed to the backend as is; it validates and answers with the person's status after it. */
export async function PUT(request: Request, ctx: RouteContext<"/api/ops/billing/people/[userId]/plan">): Promise<Response> {
  const { userId } = await ctx.params;
  if (!UUID.test(userId)) return Response.json({ error: "userId must be a UUID" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return Response.json({ error: "Send { plan, expires_at }" }, { status: 400 });
  try {
    return Response.json(await setPlan(userId, body), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
