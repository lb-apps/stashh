import { AppHttpError } from "../../errors/appHttpError.js";
import { isPostgrestError } from "../../errors/supabaseHttp.js";
import type { BillingRepository } from "./repository.js";
import type { BillingStatus, MockPeriod, Plan, TaskReward } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_PERIOD_DAYS: Record<MockPeriod, number> = { monthly: 30, yearly: 365 };

/** `grant_credits()` refusing an amount (an overdraw, a zero): the caller's mistake, not ours. */
const INVALID_PARAMETER = "22023";

export class BillingService {
  constructor(private readonly repository: BillingRepository) {}

  status(userId: string): Promise<BillingStatus> {
    return this.repository.status(userId);
  }

  /** The paywall while there are no payments: Premium for a period, when the owner switched it on. */
  async mockPurchase(userId: string, period: MockPeriod, now = new Date()): Promise<BillingStatus> {
    const status = await this.repository.status(userId);
    if (!status.mock_purchases) {
      throw new AppHttpError(403, "Premium cannot be bought yet", "PURCHASES_UNAVAILABLE");
    }
    const expiresAt = new Date(now.getTime() + MOCK_PERIOD_DAYS[period] * DAY_MS);
    return this.repository.setPlan(userId, "premium", "mock", expiresAt, null);
  }

  /** The first sign-in on the web earns its task's credits once; null when nothing was earned. */
  async rewardFirstWebVisit(userId: string): Promise<TaskReward | null> {
    const grant = await this.repository.claimTask(userId, "first_web_visit");
    return grant.granted && grant.credits ? { task: "first_web_visit", credits: grant.credits } : null;
  }

  /** The owner adds or removes credits from ops. `requestId` makes a retried request apply once. */
  async adminGrantCredits(userId: string, delta: number, requestId: string): Promise<BillingStatus> {
    try {
      await this.repository.grantCredits(userId, delta, "admin", `ops:${requestId}`);
    } catch (error) {
      if (isPostgrestError(error) && error.code === INVALID_PARAMETER) {
        throw new AppHttpError(400, error.message, "INVALID_CREDITS");
      }
      throw error;
    }
    return this.repository.status(userId);
  }

  /** The owner sets a plan from ops; Premium without an end date lasts until changed. */
  adminSetPlan(userId: string, plan: Plan, expiresAt: Date | null): Promise<BillingStatus> {
    return this.repository.setPlan(userId, plan, "admin", plan === "premium" ? expiresAt : null, null);
  }
}
