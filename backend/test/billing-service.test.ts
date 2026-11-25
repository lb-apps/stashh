import { describe, expect, it } from "vitest";
import type { BillingRepository } from "../src/modules/billing/repository.js";
import { BillingService } from "../src/modules/billing/service.js";
import { billingStatusSchema, type BillingStatus, type CreditGrant } from "../src/modules/billing/types.js";

const USER = "00000000-0000-4000-8000-000000000001";

function status(partial: Partial<BillingStatus> = {}): BillingStatus {
  return {
    plan: "free",
    plan_source: "default",
    plan_expires_at: null,
    store: null,
    daily_limit: 3,
    used_today: 0,
    plan_limits: { free: 3, premium: 30 },
    next_free_at: null,
    credits: 0,
    mock_purchases: false,
    tasks: [{ task: "first_list", credits: 3, done: false }],
    ...partial,
  };
}

class FakeRepository {
  current = status();
  plans: Array<{ plan: string; source: string; expiresAt: Date | null }> = [];
  claim: CreditGrant = { granted: true, credits: 3, balance: 3 };
  grantError: unknown = null;

  async status() {
    return this.current;
  }
  async setPlan(_userId: string, plan: "free" | "premium", source: string, expiresAt: Date | null) {
    this.plans.push({ plan, source, expiresAt });
    this.current = status({ ...this.current, plan, plan_source: source as BillingStatus["plan_source"], plan_expires_at: expiresAt?.toISOString() ?? null });
    return this.current;
  }
  async claimTask() {
    return this.claim;
  }
  async grantCredits() {
    if (this.grantError) throw this.grantError;
    return { granted: true, balance: 5 };
  }
}

function setup() {
  const repo = new FakeRepository();
  return { repo, service: new BillingService(repo as unknown as BillingRepository) };
}

describe("billingStatusSchema", () => {
  it("reads what billing_status() returns, timestamps with an offset included", () => {
    const parsed = billingStatusSchema.parse({
      plan: "premium",
      plan_source: "mock",
      plan_expires_at: "2026-12-25T14:15:41.390062+00:00",
      store: null,
      daily_limit: 300,
      used_today: 2,
      plan_limits: { free: 100, premium: 300 },
      next_free_at: null,
      credits: 4,
      mock_purchases: true,
      tasks: [{ task: "first_web_visit", credits: 3, done: true }],
    });
    expect(parsed.plan).toBe("premium");
  });
});

describe("BillingService.mockPurchase", () => {
  it("refuses while the owner has not switched mock purchases on", async () => {
    const { repo, service } = setup();
    await expect(service.mockPurchase(USER, "monthly")).rejects.toMatchObject({ status: 403, errorCode: "PURCHASES_UNAVAILABLE" });
    expect(repo.plans).toHaveLength(0);
  });

  it("grants Premium from the mock paywall for the period's days", async () => {
    const { repo, service } = setup();
    repo.current = status({ mock_purchases: true });
    const now = new Date("2026-11-25T12:00:00Z");
    await service.mockPurchase(USER, "monthly", now);
    await service.mockPurchase(USER, "yearly", now);
    expect(repo.plans).toEqual([
      { plan: "premium", source: "mock", expiresAt: new Date("2026-12-25T12:00:00Z") },
      { plan: "premium", source: "mock", expiresAt: new Date("2027-11-25T12:00:00Z") },
    ]);
  });
});

describe("BillingService.rewardFirstWebVisit", () => {
  it("reports the credits only when this visit earned them", async () => {
    const { repo, service } = setup();
    expect(await service.rewardFirstWebVisit(USER)).toEqual({ task: "first_web_visit", credits: 3 });
    repo.claim = { granted: false, credits: 3, balance: 3 };
    expect(await service.rewardFirstWebVisit(USER)).toBeNull();
    repo.claim = { granted: false, credits: 0, balance: null };
    expect(await service.rewardFirstWebVisit(USER)).toBeNull();
  });
});

describe("BillingService.adminGrantCredits", () => {
  it("turns the database's refusal of an amount into a 400", async () => {
    const { repo, service } = setup();
    repo.grantError = { code: "22023", message: "the balance is 2; cannot remove 5", details: null, hint: null };
    await expect(service.adminGrantCredits(USER, -5, "8b0c2f9e-3d43-4a1f-9a55-0d8b0c2f9e3d")).rejects.toMatchObject({
      status: 400,
      errorCode: "INVALID_CREDITS",
    });
  });

  it("returns the person's status after the change", async () => {
    const { repo, service } = setup();
    repo.current = status({ credits: 5 });
    expect((await service.adminGrantCredits(USER, 5, "8b0c2f9e-3d43-4a1f-9a55-0d8b0c2f9e3d")).credits).toBe(5);
  });
});

describe("BillingService.adminSetPlan", () => {
  it("drops the end date for free", async () => {
    const { repo, service } = setup();
    await service.adminSetPlan(USER, "free", new Date("2027-01-01T00:00:00Z"));
    expect(repo.plans[0]).toEqual({ plan: "free", source: "admin", expiresAt: null });
  });
});
