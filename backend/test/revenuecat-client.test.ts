import { describe, expect, it, vi } from "vitest";
import { RevenueCatClient, RevenueCatError, type RevenueCatSubscription } from "../src/modules/billing/revenuecat.js";

const USER = "00000000-0000-4000-8000-000000000001";

function subscription(id: string): RevenueCatSubscription {
  return {
    id,
    gives_access: true,
    environment: "sandbox",
    store: "paddle",
    current_period_ends_at: 1,
    ends_at: 1,
    entitlements: { items: [{ lookup_key: "premium" }] },
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("RevenueCatClient", () => {
  it("follows next_page and sends the secret key as a bearer token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(200, { items: [subscription("a")], next_page: `/v2/projects/proj1/customers/${USER}/subscriptions?starting_after=a` }))
      .mockResolvedValueOnce(json(200, { items: [subscription("b")], next_page: null }));
    const client = new RevenueCatClient("proj1", "sk_test", fetchImpl as unknown as typeof fetch);

    const subscriptions = await client.subscriptions(USER);

    expect(subscriptions.map((s) => s.id)).toEqual(["a", "b"]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`https://api.revenuecat.com/v2/projects/proj1/customers/${USER}/subscriptions?limit=100`);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(`https://api.revenuecat.com/v2/projects/proj1/customers/${USER}/subscriptions?starting_after=a`);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "GET", headers: { Authorization: "Bearer sk_test" } });
  });

  it("reads a customer RevenueCat has never seen as no subscriptions", async () => {
    const client = new RevenueCatClient("proj1", "sk", vi.fn().mockResolvedValue(json(404, { type: "resource_missing" })) as unknown as typeof fetch);
    expect(await client.subscriptions(USER)).toEqual([]);
  });

  it("throws on other errors without carrying the response body", async () => {
    const client = new RevenueCatClient("proj1", "sk", vi.fn().mockResolvedValue(json(401, { message: "secret detail" })) as unknown as typeof fetch);
    const error = await client.subscriptions(USER).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RevenueCatError);
    expect((error as RevenueCatError).status).toBe(401);
    expect((error as Error).message).not.toContain("secret detail");
  });

  it("turns a network failure into a RevenueCatError", async () => {
    const client = new RevenueCatClient("proj1", "sk", vi.fn().mockRejectedValue(new TypeError("fetch failed")) as unknown as typeof fetch);
    await expect(client.subscriptions(USER)).rejects.toBeInstanceOf(RevenueCatError);
  });

  it("deletes a customer, and reports when there was none", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(200, { object: "customer", id: USER, deleted_at: 1 })).mockResolvedValueOnce(json(404, {}));
    const client = new RevenueCatClient("proj 1", "sk", fetchImpl as unknown as typeof fetch);

    expect(await client.deleteCustomer(USER)).toBe(true);
    expect(await client.deleteCustomer(USER)).toBe(false);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`https://api.revenuecat.com/v2/projects/proj%201/customers/${USER}`);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
