import { z } from "zod";
import { commonErrorResponses, registry, successEnvelope } from "../../lib/openapi.js";
import { BILLING_TASKS, MOCK_PERIODS, PLANS, PLAN_SOURCES } from "./types.js";

export const billingStatusOpenApiSchema = z
  .object({
    plan: z.enum(PLANS).describe("The plan in force now; a lapsed Premium reads as free"),
    plan_source: z.enum(PLAN_SOURCES).describe("Who set the plan: nobody yet, the mock paywall, the owner, or a purchase"),
    plan_expires_at: z.string().datetime().nullable().describe("When Premium ends; null on free, or for Premium until changed"),
    store: z.string().nullable().describe("The store a Premium purchase came through (PADDLE, APP_STORE …)"),
    daily_limit: z.number().int().describe("Analyses that find a place, per rolling 24 hours, before credits are spent"),
    used_today: z.number().int().describe("Of those, taken in the last 24 hours (open ones included)"),
    plan_limits: z.object({ free: z.number().int(), premium: z.number().int() }).describe("Each plan's daily allowance, for the paywall's comparison"),
    next_free_at: z.string().datetime().nullable().describe("When the next free analysis comes back; null while one is available"),
    credits: z.number().int().describe("Credits that can be spent now"),
    mock_purchases: z.boolean().describe("The paywall grants Premium without payment (owner testing)"),
    tasks: z
      .array(
        z.object({
          task: z.enum(BILLING_TASKS),
          credits: z.number().int().describe("Credits the task earns once"),
          done: z.boolean(),
        }),
      )
      .describe("Things that earn credits once; a switched-off task is listed only when already earned"),
  })
  .openapi("BillingStatus");

registry.registerPath({
  method: "get",
  path: "/billing",
  tags: ["Billing"],
  summary: "Get plan and credits",
  description:
    "The signed-in person's plan, how many free analyses are left today and when the next one comes back, their credits, and the tasks that earn credits. Only an analysis that finds at least one place uses the allowance or a credit.",
  responses: {
    200: { description: "Plan and credits", content: { "application/json": { schema: successEnvelope(billingStatusOpenApiSchema, "GetBilling") } } },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/billing/mock-purchase",
  tags: ["Billing"],
  summary: "Mock purchase of Premium",
  description:
    "While there are no payments: grants Premium for 30 days (monthly) or 365 days (yearly) when the owner has switched `mock_purchases` on in ops. Otherwise `403 PURCHASES_UNAVAILABLE`.",
  request: {
    body: { content: { "application/json": { schema: z.object({ period: z.enum(MOCK_PERIODS) }).openapi("MockPurchaseRequest") } } },
  },
  responses: {
    200: { description: "The plan after the purchase", content: { "application/json": { schema: successEnvelope(billingStatusOpenApiSchema, "MockPurchase") } } },
    ...commonErrorResponses,
  },
});
