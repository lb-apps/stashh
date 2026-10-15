import { opsRoute } from "@/lib/ops-route";
import { fetchRecognitionOps } from "@/lib/services";

export const GET = opsRoute(fetchRecognitionOps);
