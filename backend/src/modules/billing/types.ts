import { z } from "zod";

/**
 * Plans, the daily allowance and credits. The rules live in the database
 * (`supabase/migrations/…_billing.sql`): the backend reads what they decided and never
 * counts or charges on its own.
 */

export const PLANS = ["free", "premium"] as const;
export type Plan = (typeof PLANS)[number];

/** Who set the plan: nobody yet, the mock paywall, the owner from ops, or a purchase. */
export const PLAN_SOURCES = ["default", "mock", "admin", "revenuecat"] as const;
export type PlanSource = (typeof PLAN_SOURCES)[number];

/** Things people do in the product that earn credits once. */
export const BILLING_TASKS = ["first_list", "first_web_visit"] as const;
export type BillingTask = (typeof BILLING_TASKS)[number];

export const MOCK_PERIODS = ["monthly", "yearly"] as const;
export type MockPeriod = (typeof MOCK_PERIODS)[number];

const timestamp = z.string().datetime({ offset: true });

/** `billing_status()`: what a person's plan allows right now. */
export const billingStatusSchema = z.object({
  plan: z.enum(PLANS),
  plan_source: z.enum(PLAN_SOURCES),
  plan_expires_at: timestamp.nullable(),
  store: z.string().nullable(),
  /** Analyses that find a place, per rolling 24 hours, before credits are spent. */
  daily_limit: z.number().int(),
  used_today: z.number().int(),
  /** Each plan's daily allowance, for the paywall's comparison. */
  plan_limits: z.object({ free: z.number().int(), premium: z.number().int() }),
  /** When the next free analysis comes back; null while one is available. */
  next_free_at: timestamp.nullable(),
  /** Credits that can be spent now (open reservations excluded). */
  credits: z.number().int(),
  /** The paywall grants Premium without payment (owner testing). */
  mock_purchases: z.boolean(),
  tasks: z.array(z.object({ task: z.enum(BILLING_TASKS), credits: z.number().int(), done: z.boolean() })),
});
export type BillingStatus = z.infer<typeof billingStatusSchema>;

/** Why an analysis was refused: the allowance and the credits are used up. */
export const recognitionQuotaSchema = z.object({
  plan: z.enum(PLANS),
  daily_limit: z.number().int(),
  used_today: z.number().int(),
  next_free_at: timestamp.nullable(),
  credits: z.number().int(),
});
export type RecognitionQuota = z.infer<typeof recognitionQuotaSchema>;

/** `grant_credits()` / `claim_task_reward()`. `balance` is null when a task is switched off. */
export const creditGrantSchema = z.object({
  granted: z.boolean(),
  balance: z.number().int().nullable(),
  credits: z.number().int().optional(),
});
export type CreditGrant = z.infer<typeof creditGrantSchema>;

/** A task reward as the API reports it, when one was just earned. */
export interface TaskReward {
  task: BillingTask;
  credits: number;
}

export interface BillingSettings {
  freeDailyAnalyses: number;
  premiumDailyAnalyses: number;
  firstListCredits: number;
  firstWebVisitCredits: number;
  mockPurchases: boolean;
  updatedAt: string;
}

/** What the ops dashboard may change; every field optional, bounded like the table's checks. */
export const billingSettingsPatchSchema = z
  .object({
    free_daily_analyses: z.number().int().min(0).max(1000),
    premium_daily_analyses: z.number().int().min(0).max(1000),
    first_list_credits: z.number().int().min(0).max(100),
    first_web_visit_credits: z.number().int().min(0).max(100),
    mock_purchases: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to change");
export type BillingSettingsPatch = z.infer<typeof billingSettingsPatchSchema>;
