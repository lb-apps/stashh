import { Router } from "express";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { sendError, sendSuccess } from "../../http/response.js";
import { OpsRepository } from "./repository.js";
import { z } from "zod";
import { config } from "../../config.js";
import { apiMetrics } from "../../lib/api-metrics.js";
import { opsQuerySchema, resolveOpsRange } from "./types.js";
import { sendTestUserToken } from "./test-user-token.js";

const startedAt = new Date();

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
    const [stats, dependencies, queue, recognitions] = await Promise.all([
      repository.recognitionStats(range),
      repository.dependencies(range),
      repository.liveQueue(),
      repository.recentRecognitions(),
    ]);
    sendSuccess(res, req, 200, {
      range: range.range,
      since: range.since.toISOString(),
      bucket: range.bucket,
      generated_at: new Date().toISOString(),
      stats,
      dependencies,
      queue,
      recognitions,
      // This instance only: API traffic since start, and how the worker is configured.
      process: {
        started_at: startedAt.toISOString(),
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        worker_concurrency: config.RECOGNITIONS_WORKER_CONCURRENCY,
        model: config.OPENROUTER_MODEL,
        api: apiMetrics.snapshot(),
      },
    });
  } catch (error) {
    next(error);
  }
});

opsRouter.get("/recognitions/:id", async (req, res, next) => {
  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!params.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Recognition id must be a UUID");
    return;
  }
  try {
    const detail = await new OpsRepository(createSupabaseServiceClient()).recognitionDetail(params.data.id);
    if (!detail) {
      sendError(res, req, 404, "NOT_FOUND", "Recognition not found");
      return;
    }
    sendSuccess(res, req, 200, detail);
  } catch (error) {
    next(error);
  }
});

/** The test user's token, so the ops dashboard's link tester calls the public API as the app does. */
opsRouter.get("/test-user-token", sendTestUserToken);
