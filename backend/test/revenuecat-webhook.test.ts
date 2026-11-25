import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { BillingService } from "../src/modules/billing/service.js";
import { createRevenueCatWebhook, eventUserIds } from "../src/modules/billing/webhook.js";

const AUTH = `Bearer ${"w".repeat(40)}`;
const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";

function fakeService(partial: { enabled?: boolean; environments?: string[]; unknown?: string[] } = {}) {
  const synced: string[] = [];
  const environments = new Set(partial.environments ?? ["sandbox", "production"]);
  const service = {
    purchasesEnabled: partial.enabled ?? true,
    acceptsEnvironment: (environment: string) => environments.has(environment.toLowerCase()),
    syncFromRevenueCat: vi.fn(async (userId: string) => {
      synced.push(userId);
      return partial.unknown?.includes(userId) ? null : ({ plan: "premium" } as never);
    }),
  };
  return { service: service as unknown as BillingService, synced };
}

async function run(options: { auth?: string | undefined; header?: string; body?: unknown; service?: BillingService }) {
  const req = {
    headers: options.header ? { authorization: options.header } : {},
    body: options.body,
    requestId: "test",
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  const service = options.service ?? fakeService().service;
  await createRevenueCatWebhook("auth" in options ? options.auth : AUTH, () => service)(req, res, next);
  return { res, next, status: (res.status as ReturnType<typeof vi.fn>).mock.calls[0]?.[0], json: (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] };
}

const event = (partial: Record<string, unknown> = {}) => ({
  api_version: "1.0",
  event: { id: "evt1", type: "INITIAL_PURCHASE", environment: "SANDBOX", app_user_id: USER, original_app_user_id: USER, aliases: [USER], ...partial },
});

describe("RevenueCat webhook", () => {
  it("answers 503 while its Authorization value is not configured, so RevenueCat retries later", async () => {
    expect((await run({ auth: undefined, header: AUTH, body: event() })).status).toBe(503);
  });

  it.each([
    ["no header", undefined],
    ["a wrong value", `Bearer ${"x".repeat(40)}`],
    ["a prefix of the right value", AUTH.slice(0, 20)],
  ])("rejects %s with 401 and syncs nothing", async (_label, header) => {
    const { service, synced } = fakeService();
    const result = await run({ header, body: event(), service });
    expect(result.status).toBe(401);
    expect(synced).toEqual([]);
  });

  it("rejects a body that is not an event", async () => {
    expect((await run({ header: AUTH, body: { hello: "world" } })).status).toBe(400);
  });

  it("answers 503 when the server has no RevenueCat key, instead of dropping the event", async () => {
    const { service, synced } = fakeService({ enabled: false });
    expect((await run({ header: AUTH, body: event(), service })).status).toBe(503);
    expect(synced).toEqual([]);
  });

  it("syncs every person the event names, once each", async () => {
    const { service, synced } = fakeService({ unknown: [OTHER] });
    const result = await run({ header: AUTH, body: event({ type: "TRANSFER", transferred_from: [OTHER], transferred_to: [USER] }), service });
    expect(result.status).toBe(200);
    expect(synced).toEqual([USER, OTHER]);
    expect(result.json.data).toEqual({ event_id: "evt1", synced: 1 });
  });

  it("acknowledges dashboard tests and environments not granted here without syncing", async () => {
    const test = fakeService();
    expect((await run({ header: AUTH, body: event({ type: "TEST" }), service: test.service })).status).toBe(200);
    expect(test.synced).toEqual([]);

    const productionOnly = fakeService({ environments: ["production"] });
    expect((await run({ header: AUTH, body: event({ environment: "SANDBOX" }), service: productionOnly.service })).status).toBe(200);
    expect(productionOnly.synced).toEqual([]);
  });

  it("hands a failed sync to the error handler, so RevenueCat retries", async () => {
    const { service } = fakeService();
    vi.mocked(service.syncFromRevenueCat).mockRejectedValueOnce(new Error("RevenueCat GET answered 500"));
    const { next, status } = await run({ header: AUTH, body: event(), service });
    expect(status).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe("eventUserIds", () => {
  it("keeps Supabase user ids and drops RevenueCat's anonymous ids", () => {
    expect(
      eventUserIds({ id: "e", type: "RENEWAL", app_user_id: "$RCAnonymousID:abc", original_app_user_id: USER, aliases: ["$RCAnonymousID:abc", USER, OTHER] }),
    ).toEqual([USER, OTHER]);
  });
});
