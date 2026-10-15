import { opsRoute } from "@/lib/ops-route";
import { fetchInstagramOps } from "@/lib/services";

export const GET = opsRoute(fetchInstagramOps);
