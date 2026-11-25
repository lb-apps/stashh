import { Router } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../../http/response.js";
import { createBillingService } from "./factory.js";
import { MOCK_PERIODS } from "./types.js";

/** The signed-in person's plan, allowance, credits and tasks. Mounted at `/api/v1/billing`. */
export const billingRouter = Router();

billingRouter.get("/", async (req, res, next) => {
  const userId = req.user?.sub;
  if (!userId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    sendSuccess(res, req, 200, await createBillingService().status(userId));
  } catch (error) {
    next(error);
  }
});

/** After a purchase on the web: the plan RevenueCat gives now, without waiting for the webhook. */
billingRouter.post("/sync", async (req, res, next) => {
  const userId = req.user?.sub;
  if (!userId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const status = await createBillingService().syncFromRevenueCat(userId);
    if (!status) {
      sendError(res, req, 404, "NOT_FOUND", "User not found");
      return;
    }
    sendSuccess(res, req, 200, status);
  } catch (error) {
    next(error);
  }
});

const mockPurchaseSchema = z.object({ period: z.enum(MOCK_PERIODS) });

billingRouter.post("/mock-purchase", async (req, res, next) => {
  const userId = req.user?.sub;
  if (!userId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  const body = mockPurchaseSchema.safeParse(req.body);
  if (!body.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request body", body.error.flatten().fieldErrors);
    return;
  }
  try {
    sendSuccess(res, req, 200, await createBillingService().mockPurchase(userId, body.data.period));
  } catch (error) {
    next(error);
  }
});
