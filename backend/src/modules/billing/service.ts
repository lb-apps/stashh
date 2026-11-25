import { AppHttpError } from "../../errors/appHttpError.js";
import { isPostgrestError } from "../../errors/supabaseHttp.js";
import type { BillingRepository } from "./repository.js";
import type { RevenueCatCustomers, RevenueCatSubscription } from "./revenuecat.js";
import { PREMIUM_ENTITLEMENT, type BillingStatus, type MockPeriod, type Plan, type TaskReward } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MOCK_PERIOD_DAYS: Record<MockPeriod, number> = { monthly: 30, yearly: 365 };

/** `grant_credits()` refusing an amount (an overdraw, a zero): the caller's mistake, not ours. */
const INVALID_PARAMETER = "22023";
/** A billing row for a user id that is not (or no longer) in `auth.users`. */
const FOREIGN_KEY_VIOLATION = "23503";

/** RevenueCat access and the store environments whose subscriptions grant Premium here. */
export interface RevenueCatAccess {
  customers: RevenueCatCustomers;
  environments: ReadonlySet<string>;
}

export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly revenueCat: RevenueCatAccess | null = null,
  ) {}

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

  /** Whether RevenueCat is set up here (project and secret key). */
  get purchasesEnabled(): boolean {
    return this.revenueCat !== null;
  }

  /** Whether subscriptions from this store environment ("SANDBOX", "production" …) count here. */
  acceptsEnvironment(environment: string): boolean {
    return this.revenueCat?.environments.has(environment.toLowerCase()) ?? false;
  }

  /**
   * Writes the plan the person's RevenueCat subscriptions give right now, and returns it. It
   * re-reads RevenueCat's state instead of applying a change, so the webhook, the web after a
   * purchase and every retry can call it in any order, as often as they like. When nothing
   * grants Premium, only a plan that RevenueCat set falls back to Free; the owner's and the mock
   * paywall's are left alone. Null when there is no such person.
   */
  async syncFromRevenueCat(userId: string): Promise<BillingStatus | null> {
    const revenueCat = this.requireRevenueCat();
    const granting = (await revenueCat.customers.subscriptions(userId)).filter(
      (subscription) =>
        subscription.gives_access &&
        revenueCat.environments.has(subscription.environment) &&
        subscription.entitlements.items.some((entitlement) => entitlement.lookup_key === PREMIUM_ENTITLEMENT),
    );
    try {
      const longest = latestEnding(granting);
      if (longest) {
        const ends = subscriptionEnd(longest);
        return await this.repository.setPlan(userId, "premium", "revenuecat", ends === null ? null : new Date(ends), longest.store.toUpperCase());
      }
      const status = await this.repository.status(userId);
      if (status.plan === "premium" && status.plan_source === "revenuecat") {
        return await this.repository.setPlan(userId, "free", "revenuecat", null, null);
      }
      return status;
    } catch (error) {
      if (isPostgrestError(error) && error.code === FOREIGN_KEY_VIOLATION) return null;
      throw error;
    }
  }

  /**
   * Deletes the person's RevenueCat customer when they are erased; false when there was none, or
   * when purchases are not set up here (then there is nothing this server could have created).
   */
  async eraseRevenueCatCustomer(userId: string): Promise<boolean> {
    if (!this.revenueCat) return false;
    return this.revenueCat.customers.deleteCustomer(userId);
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

  private requireRevenueCat(): RevenueCatAccess {
    if (!this.revenueCat) throw new AppHttpError(503, "Purchases are not set up", "PURCHASES_UNAVAILABLE");
    return this.revenueCat;
  }
}

/** When a subscription's access ends, in ms; null while paused with no end date (it lasts until changed). */
function subscriptionEnd(subscription: RevenueCatSubscription): number | null {
  return subscription.ends_at ?? subscription.current_period_ends_at;
}

/** The subscription whose access lasts longest; an open-ended one wins. */
function latestEnding(subscriptions: RevenueCatSubscription[]): RevenueCatSubscription | undefined {
  const reach = (subscription: RevenueCatSubscription) => subscriptionEnd(subscription) ?? Number.POSITIVE_INFINITY;
  return subscriptions.reduce<RevenueCatSubscription | undefined>((best, next) => (!best || reach(next) > reach(best) ? next : best), undefined);
}
