import type { OpsRange } from "./ops-types";

/**
 * Plans and credits, as the backend's ops endpoints return them: GET /internal/v1/ops/billing
 * (+ /settings, /people, /people/:userId/credits, /people/:userId/plan).
 * An analysis is a recognition that found at least one place; the plan's daily allowance or
 * one credit pays for it. A refusal is a share that arrived with neither left.
 */

export type Plan = "free" | "premium";
/** Who set the plan: nobody yet, the test paywall, the owner from here, or a store purchase. */
export type PlanSource = "default" | "mock" | "admin" | "revenuecat";
export type BillingTask = "first_list" | "first_web_visit";
export type CreditReason = "task" | "purchase" | "recognition" | "admin";

export interface BillingSeriesPoint {
  bucket: string;
  allowance: number;
  credit: number;
  refusals: number;
}

export interface BillingStats {
  totals: {
    /** Now, whatever the range. */
    premium_people: number;
    analyses_allowance: number;
    analyses_credit: number;
    refusals: number;
    people_refused: number;
    credits_earned: number;
    credits_spent: number;
    /** Now, whatever the range. */
    credits_held: number;
  };
  /** `ref` is the task's name for a task reward, the reason otherwise. */
  earned_by: Array<{ reason: Exclude<CreditReason, "recognition">; ref: string; credits: number }>;
  series: BillingSeriesPoint[];
}

/** One credit in or out. `ref`: the task's name, the store transaction, the recognition id, or an ops request id. */
export interface CreditMovement {
  id: number;
  user_id: string;
  username: string | null;
  delta: number;
  reason: CreditReason;
  ref: string;
  balance_after: number;
  created_at: string;
}

export interface BillingOps {
  range: OpsRange;
  since: string;
  bucket: "hour" | "day";
  generated_at: string;
  stats: BillingStats;
  /** The latest 50, whatever the range. */
  ledger: CreditMovement[];
}

export interface BillingSettings {
  free_daily_analyses: number;
  premium_daily_analyses: number;
  first_list_credits: number;
  first_web_visit_credits: number;
  /** The web paywall grants Premium without payment: owner testing only. */
  mock_purchases: boolean;
  updated_at: string;
}

export type BillingSettingsPatch = Partial<Omit<BillingSettings, "updated_at">>;

/** The backend's bounds, checked here first so a bad value never leaves the form. */
export const DAILY_ANALYSES_MAX = 1000;
export const TASK_CREDITS_MAX = 100;
export const CREDIT_CHANGE_MAX = 1000;

/** `billing_status()`: what a person's plan allows right now. */
export interface BillingStatus {
  /** The plan in force: a lapsed Premium reads as free. */
  plan: Plan;
  plan_source: PlanSource;
  plan_expires_at: string | null;
  store: string | null;
  /** Analyses per rolling 24 hours before credits are spent. */
  daily_limit: number;
  used_today: number;
  plan_limits: { free: number; premium: number };
  /** When the next free analysis comes back; null while one is available. */
  next_free_at: string | null;
  /** Credits that can be spent now. */
  credits: number;
  mock_purchases: boolean;
  tasks: Array<{ task: BillingTask; credits: number; done: boolean }>;
}

export interface BillingPerson {
  user_id: string;
  username: string | null;
  display_name: string | null;
  status: BillingStatus;
}
