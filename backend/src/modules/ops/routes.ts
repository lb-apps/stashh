import { Router } from "express";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { sendError, sendSuccess } from "../../http/response.js";
import { OpsRepository } from "./repository.js";
import { opsQuerySchema, resolveOpsRange } from "./types.js";

/**
 * What the recognition system is doing, for the local ops dashboard. Mounted under
 * `/internal/v1`, so it sits behind the service token like every internal route.
 */
export const opsRouter = Router();

opsRouter.get("/recognitions", async (req, res, next) => {
  const query = opsQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid range", query.error.flatten().fieldErrors);
    return;
  }

  try {
    const range = resolveOpsRange(query.data.range);
    const repository = new OpsRepository(createSupabaseServiceClient());
    const [stats, queue, recentRuns] = await Promise.all([
      repository.recognitionStats(range),
      repository.liveQueue(),
      repository.recentRuns(),
    ]);
    sendSuccess(res, req, 200, {
      range: range.range,
      since: range.since.toISOString(),
      bucket: range.bucket,
      generated_at: new Date().toISOString(),
      stats,
      queue,
      recent_runs: recentRuns,
    });
  } catch (error) {
    next(error);
  }
});
