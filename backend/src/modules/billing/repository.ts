import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import {
  billingStatusSchema,
  creditGrantSchema,
  type BillingSettings,
  type BillingSettingsPatch,
  type BillingStatus,
  type BillingTask,
  type CreditGrant,
  type Plan,
  type PlanSource,
} from "./types.js";

type SettingsRow = Database["public"]["Tables"]["billing_settings"]["Row"];

function toSettings(row: SettingsRow): BillingSettings {
  return {
    freeDailyAnalyses: row.free_daily_analyses,
    premiumDailyAnalyses: row.premium_daily_analyses,
    firstListCredits: row.first_list_credits,
    firstWebVisitCredits: row.first_web_visit_credits,
    mockPurchases: row.mock_purchases,
    updatedAt: row.updated_at,
  };
}

/** Plans and credits, through the database functions that own the rules. Service role only. */
export class BillingRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async status(userId: string): Promise<BillingStatus> {
    const { data, error } = await this.db.rpc("billing_status", { p_user_id: userId });
    if (error) throw error;
    return billingStatusSchema.parse(data);
  }

  /** A task's reward, once, at today's setting. */
  async claimTask(userId: string, task: BillingTask): Promise<CreditGrant> {
    const { data, error } = await this.db.rpc("claim_task_reward", { p_user_id: userId, p_task: task });
    if (error) throw error;
    return creditGrantSchema.parse(data);
  }

  /** Adds (or, for admin, removes) credits once per (user, reason, ref). */
  async grantCredits(userId: string, delta: number, reason: "admin" | "purchase", ref: string): Promise<CreditGrant> {
    const { data, error } = await this.db.rpc("grant_credits", { p_user_id: userId, p_delta: delta, p_reason: reason, p_ref: ref });
    if (error) throw error;
    return creditGrantSchema.parse(data);
  }

  async setPlan(userId: string, plan: Plan, source: PlanSource, expiresAt: Date | null, store: string | null): Promise<BillingStatus> {
    const { data, error } = await this.db.rpc("set_billing_plan", {
      p_user_id: userId,
      p_plan: plan,
      p_source: source,
      p_expires_at: expiresAt?.toISOString() ?? null,
      p_store: store,
    });
    if (error) throw error;
    return billingStatusSchema.parse(data);
  }

  async settings(): Promise<BillingSettings> {
    const { data, error } = await this.db.from("billing_settings").select("*").eq("id", true).single();
    if (error) throw error;
    return toSettings(data);
  }

  async updateSettings(patch: BillingSettingsPatch): Promise<BillingSettings> {
    const { data, error } = await this.db.from("billing_settings").update(patch).eq("id", true).select("*").single();
    if (error) throw error;
    return toSettings(data);
  }

  async opsStats(since: Date, bucket: "hour" | "day"): Promise<Json> {
    const { data, error } = await this.db.rpc("billing_ops_stats", { p_since: since.toISOString(), p_bucket: bucket });
    if (error) throw error;
    return data;
  }

  async opsLedger(limit: number): Promise<Json> {
    const { data, error } = await this.db.rpc("billing_ops_ledger", { p_limit: limit });
    if (error) throw error;
    return data;
  }

  async opsPeople(query: string, limit: number): Promise<Json> {
    const { data, error } = await this.db.rpc("billing_ops_people", { p_query: query, p_limit: limit });
    if (error) throw error;
    return data;
  }
}
