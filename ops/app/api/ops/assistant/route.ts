import { opsRoute } from "@/lib/ops-route";
import { fetchAssistantOps } from "@/lib/services";

export const GET = opsRoute(fetchAssistantOps);
