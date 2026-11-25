import { fetchMenuList } from "@/lib/services";

export async function GET(): Promise<Response> {
  try {
    const menus = await fetchMenuList();
    return Response.json(menus, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Menus service unavailable" }, { status: 502 });
  }
}
