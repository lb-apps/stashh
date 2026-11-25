import { describe, expect, it } from "vitest";
import type { BillingRepository } from "../src/modules/billing/repository.js";
import type { RevenueCatCustomers, RevenueCatSubscription } from "../src/modules/billing/revenuecat.js";
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
  stores: Array<string | null> = [];
  /** Thrown by every read and write, as PostgREST would for a person not in auth.users. */
  missingUser = false;
  claim: CreditGrant = { granted: true, credits: 3, balance: 3 };
  grantError: unknown = null;

  async status() {
    if (this.missingUser) throw { code: "23503", message: "violates foreign key constraint", details: null, hint: null };
    return this.current;
  }
  async setPlan(_userId: string, plan: "free" | "premium", source: string, expiresAt: Date | null, store: string | null = null) {
    if (this.missingUser) throw { code: "23503", message: "violates foreign key constraint", details: null, hint: null };
    this.plans.push({ plan, source, expiresAt });
    this.stores.push(store);
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

const PERIOD_END = Date.parse("2026-12-25T12:00:00Z");

function subscription(partial: Partial<RevenueCatSubscription> = {}): RevenueCatSubscription {
  return {
    id: "sub1",
    gives_access: true,
    environment: "sandbox",
    store: "paddle",
    current_period_ends_at: PERIOD_END,
    ends_at: PERIOD_END,
    entitlements: { items: [{ lookup_key: "premium" }] },
    ...partial,
  };
}

function setupWithRevenueCat(subscriptions: RevenueCatSubscription[], environments: string[] = ["sandbox", "production"]) {
  const repo = new FakeRepository();
  const customers: RevenueCatCustomers = {
    subscriptions: async () => subscriptions,
    deleteCustomer: async () => true,
  };
  const service = new BillingService(repo as unknown as BillingRepository, { customers, environments: new Set(environments) });
  return { repo, service };
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

describe("BillingService.syncFromRevenueCat", () => {
  it("answers 503 while purchases are not set up", async () => {
    const { service } = setup();
    await expect(service.syncFromRevenueCat(USER)).rejects.toMatchObject({ status: 503, errorCode: "PURCHASES_UNAVAILABLE" });
    expect(service.purchasesEnabled).toBe(false);
  });

  it("grants Premium until the subscription's period ends, with its store", async () => {
    const { repo, service } = setupWithRevenueCat([subscription()]);
    const result = await service.syncFromRevenueCat(USER);
    expect(repo.plans).toEqual([{ plan: "premium", source: "revenuecat", expiresAt: new Date(PERIOD_END) }]);
    expect(repo.stores).toEqual(["PADDLE"]);
    expect(result?.plan).toBe("premium");
  });

  it("takes the subscription that lasts longest, and an open-ended one over any date", async () => {
    const later = PERIOD_END + 1000;
    const dated = setupWithRevenueCat([subscription({ ends_at: PERIOD_END }), subscription({ id: "sub2", ends_at: later, store: "app_store" })]);
    await dated.service.syncFromRevenueCat(USER);
    expect(dated.repo.plans[0]?.expiresAt).toEqual(new Date(later));
    expect(dated.repo.stores).toEqual(["APP_STORE"]);

    const paused = setupWithRevenueCat([subscription(), subscription({ id: "sub2", ends_at: null, current_period_ends_at: null })]);
    await paused.service.syncFromRevenueCat(USER);
    expect(paused.repo.plans[0]?.expiresAt).toBeNull();
  });

  it("ignores subscriptions that give no access, belong to another entitlement or an environment not granted here", async () => {
    const { repo, service } = setupWithRevenueCat(
      [
        subscription({ gives_access: false }),
        subscription({ entitlements: { items: [{ lookup_key: "something_else" }] } }),
        subscription({ environment: "sandbox" }),
      ],
      ["production"],
    );
    await service.syncFromRevenueCat(USER);
    expect(repo.plans).toEqual([]);
  });

  it("drops a Premium that RevenueCat set once nothing grants it", async () => {
    const { repo, service } = setupWithRevenueCat([subscription({ gives_access: false })]);
    repo.current = status({ plan: "premium", plan_source: "revenuecat" });
    await service.syncFromRevenueCat(USER);
    expect(repo.plans).toEqual([{ plan: "free", source: "revenuecat", expiresAt: null }]);
  });

  it("leaves a Premium from the owner or the mock paywall alone", async () => {
    for (const source of ["admin", "mock"] as const) {
      const { repo, service } = setupWithRevenueCat([]);
      repo.current = status({ plan: "premium", plan_source: source });
      expect((await service.syncFromRevenueCat(USER))?.plan).toBe("premium");
      expect(repo.plans).toEqual([]);
    }
  });

  it("returns null for an id that is no Stashh person", async () => {
    const granted = setupWithRevenueCat([subscription()]);
    granted.repo.missingUser = true;
    expect(await granted.service.syncFromRevenueCat(USER)).toBeNull();

    const nothing = setupWithRevenueCat([]);
    nothing.repo.missingUser = true;
    expect(await nothing.service.syncFromRevenueCat(USER)).toBeNull();
  });

  it("reads store environments case-insensitively, as webhooks spell them in capitals", () => {
    const { service } = setupWithRevenueCat([], ["production"]);
    expect(service.acceptsEnvironment("PRODUCTION")).toBe(true);
    expect(service.acceptsEnvironment("SANDBOX")).toBe(false);
  });
});

describe("BillingService.eraseRevenueCatCustomer", () => {
  it("deletes the customer when purchases are set up, and does nothing otherwise", async () => {
    expect(await setup().service.eraseRevenueCatCustomer(USER)).toBe(false);
    expect(await setupWithRevenueCat([]).service.eraseRevenueCatCustomer(USER)).toBe(true);
  });
});
