import { Router } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../../http/response.js";
import { opsQuerySchema, resolveOpsRange } from "../ops/types.js";
import { createBillingRepository, createBillingService } from "./factory.js";
import { PLANS, billingSettingsPatchSchema, type BillingSettings } from "./types.js";

/**
 * Plans and credits for the local ops dashboard: numbers, settings, and a person's plan and
 * credits. Mounted under `/internal/v1/ops/billing`, behind the service token.
 */
export const billingOpsRouter = Router();

billingOpsRouter.get("/", async (req, res, next) => {
  const query = opsQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid range", query.error.flatten().fieldErrors);
    return;
  }
  try {
    const range = resolveOpsRange(query.data.range);
    const repository = createBillingRepository();
    const [stats, ledger] = await Promise.all([repository.opsStats(range.since, range.bucket), repository.opsLedger(50)]);
    sendSuccess(res, req, 200, {
      range: range.range,
      since: range.since.toISOString(),
      bucket: range.bucket,
      generated_at: new Date().toISOString(),
      stats,
      ledger,
    });
  } catch (error) {
    next(error);
  }
});

function presentSettings(settings: BillingSettings) {
  return {
    free_daily_analyses: settings.freeDailyAnalyses,
    premium_daily_analyses: settings.premiumDailyAnalyses,
    first_list_credits: settings.firstListCredits,
    first_web_visit_credits: settings.firstWebVisitCredits,
    mock_purchases: settings.mockPurchases,
    updated_at: settings.updatedAt,
  };
}

billingOpsRouter.get("/settings", async (req, res, next) => {
  try {
    sendSuccess(res, req, 200, presentSettings(await createBillingRepository().settings()));
  } catch (error) {
    next(error);
  }
});

/** Changes one or more settings; the next analysis and the next status read use them. */
billingOpsRouter.put("/settings", async (req, res, next) => {
  const body = billingSettingsPatchSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid settings", body.error.flatten().fieldErrors);
    return;
  }
  const repository = createBillingRepository();
  try {
    // Premium never allows fewer analyses than free; the table refuses it too.
    const current = await repository.settings();
    const free = body.data.free_daily_analyses ?? current.freeDailyAnalyses;
    const premium = body.data.premium_daily_analyses ?? current.premiumDailyAnalyses;
    if (premium < free) {
      sendError(res, req, 400, "VALIDATION_ERROR", "Invalid settings", {
        premium_daily_analyses: ["Must be at least the free plan's daily analyses"],
      });
      return;
    }
    sendSuccess(res, req, 200, presentSettings(await repository.updateSettings(body.data)));
  } catch (error) {
    next(error);
  }
});

const peopleQuerySchema = z.object({ q: z.string().trim().min(2).max(100) });

/** People by Instagram username (part of it) or exact user id, with their plan and credits. */
billingOpsRouter.get("/people", async (req, res, next) => {
  const query = peopleQuerySchema.safeParse(req.query);
  if (!query.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid query", query.error.flatten().fieldErrors);
    return;
  }
  try {
    sendSuccess(res, req, 200, { items: await createBillingRepository().opsPeople(query.data.q, 20) });
  } catch (error) {
    next(error);
  }
});

const userParamsSchema = z.object({ userId: z.string().uuid("userId must be a UUID") });

const grantBodySchema = z.object({
  /** Credits to add, or remove when negative. */
  delta: z.number().int().min(-1000).max(1000).refine((n) => n !== 0, "Must not be 0"),
  /** The dashboard's id for this change, so a retried request applies once. */
  request_id: z.string().uuid(),
});

billingOpsRouter.post("/people/:userId/credits", async (req, res, next) => {
  const params = userParamsSchema.safeParse(req.params);
  const body = grantBodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request", {
      ...(params.success ? {} : params.error.flatten().fieldErrors),
      ...(body.success ? {} : body.error.flatten().fieldErrors),
    });
    return;
  }
  try {
    sendSuccess(res, req, 200, await createBillingService().adminGrantCredits(params.data.userId, body.data.delta, body.data.request_id));
  } catch (error) {
    next(error);
  }
});

const planBodySchema = z.object({
  plan: z.enum(PLANS),
  /** When Premium ends; null or absent = until changed. Ignored for free. */
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

billingOpsRouter.put("/people/:userId/plan", async (req, res, next) => {
  const params = userParamsSchema.safeParse(req.params);
  const body = planBodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request", {
      ...(params.success ? {} : params.error.flatten().fieldErrors),
      ...(body.success ? {} : body.error.flatten().fieldErrors),
    });
    return;
  }
  try {
    const expiresAt = body.data.expires_at ? new Date(body.data.expires_at) : null;
    sendSuccess(res, req, 200, await createBillingService().adminSetPlan(params.data.userId, body.data.plan, expiresAt));
  } catch (error) {
    next(error);
  }
});
