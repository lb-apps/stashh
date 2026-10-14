import { describe, expect, it } from "vitest";
import type { AuthUserAdmin } from "../src/modules/identities/auth-user-admin.js";
import type { ChannelIdentityRepository } from "../src/modules/identities/repository.js";
import { ChannelIdentityService, channelUserId } from "../src/modules/identities/service.js";
import type { ChannelIdentity, ChannelProvider } from "../src/modules/identities/types.js";

class InMemoryIdentities {
  rows = new Map<string, ChannelIdentity>();
  async find(provider: ChannelProvider, externalId: string) {
    return this.rows.get(`${provider}:${externalId}`) ?? null;
  }
  async insert(identity: ChannelIdentity) {
    const key = `${identity.provider}:${identity.externalId}`;
    if (!this.rows.has(key)) this.rows.set(key, identity);
  }
}

class FakeAuthAdmin implements AuthUserAdmin {
  users = new Map<string, string>();
  createCalls: { id: string; email: string; appMetadata: Record<string, unknown> }[] = [];
  async createUser(params: { id: string; email: string; appMetadata: Record<string, unknown> }) {
    this.createCalls.push(params);
    if (this.users.has(params.id)) return "exists" as const;
    this.users.set(params.id, params.email);
    return "created" as const;
  }
  async deleteUser(id: string) {
    return this.users.delete(id) ? ("deleted" as const) : ("not_found" as const);
  }
}

function setup() {
  const identities = new InMemoryIdentities();
  const auth = new FakeAuthAdmin();
  const service = new ChannelIdentityService(
    identities as unknown as ChannelIdentityRepository,
    auth,
    "identities.stashh.me",
  );
  return { identities, auth, service };
}

describe("channelUserId", () => {
  it("is deterministic and distinct per provider and id", () => {
    expect(channelUserId("instagram", "123")).toBe(channelUserId("instagram", "123"));
    expect(channelUserId("instagram", "123")).not.toBe(channelUserId("instagram", "124"));
    expect(channelUserId("instagram", "123")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("ChannelIdentityService.resolve", () => {
  it("creates the user with the derived id and a reserved address, then maps it", async () => {
    const { auth, identities, service } = setup();
    const resolved = await service.resolve("instagram", "17841400000000001");

    const expectedId = channelUserId("instagram", "17841400000000001");
    expect(resolved).toEqual({ provider: "instagram", externalId: "17841400000000001", userId: expectedId, created: true });
    expect(auth.createCalls).toEqual([
      { id: expectedId, email: "instagram-17841400000000001@identities.stashh.me", appMetadata: { channel: "instagram" } },
    ]);
    expect(await identities.find("instagram", "17841400000000001")).toMatchObject({ userId: expectedId });
  });

  it("returns the existing mapping without touching Auth", async () => {
    const { auth, service } = setup();
    await service.resolve("instagram", "42");
    auth.createCalls = [];

    const again = await service.resolve("instagram", "42");
    expect(again.created).toBe(false);
    expect(auth.createCalls).toHaveLength(0);
  });

  it("completes an attempt that crashed after creating the Auth user", async () => {
    const { auth, identities, service } = setup();
    auth.users.set(channelUserId("instagram", "7"), "instagram-7@identities.stashh.me");

    const resolved = await service.resolve("instagram", "7");
    expect(resolved.created).toBe(false);
    expect(await identities.find("instagram", "7")).not.toBeNull();
  });

  it("converges concurrent first contacts on one user", async () => {
    const { auth, service } = setup();
    const [a, b] = await Promise.all([service.resolve("instagram", "9"), service.resolve("instagram", "9")]);
    expect(a.userId).toBe(b.userId);
    expect(auth.users.size).toBe(1);
  });
});

describe("ChannelIdentityService.erase", () => {
  it("deletes the Auth user (cascading to their data) and reports whether anything existed", async () => {
    const { auth, service } = setup();
    await service.resolve("instagram", "5");

    expect(await service.erase("instagram", "5")).toBe(true);
    expect(auth.users.size).toBe(0);
    expect(await service.erase("instagram", "5")).toBe(false);
  });
});
