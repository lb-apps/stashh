import { opsRoute } from "@/lib/ops-route";
import { fetchBillingOps } from "@/lib/services";

export const GET = opsRoute(fetchBillingOps);
