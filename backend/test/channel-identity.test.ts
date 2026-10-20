import { describe, expect, it } from "vitest";
import type { AuthUserAdmin } from "../src/modules/identities/auth-user-admin.js";
import type { ChannelIdentityRepository } from "../src/modules/identities/repository.js";
import { ChannelIdentityService, channelUserId } from "../src/modules/identities/service.js";
import { channelProfileSchema, type ChannelIdentity, type ChannelProfile, type ChannelProvider } from "../src/modules/identities/types.js";

class InMemoryIdentities {
  rows = new Map<string, ChannelIdentity>();
  profiles = new Map<string, ChannelProfile>();
  async find(provider: ChannelProvider, externalId: string) {
    return this.rows.get(`${provider}:${externalId}`) ?? null;
  }
  async insert(identity: ChannelIdentity) {
    const key = `${identity.provider}:${identity.externalId}`;
    if (!this.rows.has(key)) this.rows.set(key, identity);
  }
  async saveProfile(provider: ChannelProvider, externalId: string, profile: ChannelProfile) {
    const key = `${provider}:${externalId}`;
    if (!this.rows.has(key)) return false;
    this.profiles.set(key, profile);
    return true;
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

describe("ChannelIdentityService.resolve with a profile", () => {
  it("records the profile on first contact", async () => {
    const { identities, service } = setup();
    await service.resolve("instagram", "11", { username: "ayse.k", name: "Ayşe" });
    expect(identities.profiles.get("instagram:11")).toEqual({ username: "ayse.k", name: "Ayşe" });
  });

  it("overwrites the profile when the person renamed, and keeps it when none is sent", async () => {
    const { identities, service } = setup();
    await service.resolve("instagram", "12", { username: "old.name", name: null });
    await service.resolve("instagram", "12", { username: "new.name", name: "Deniz" });
    await service.resolve("instagram", "12");
    expect(identities.profiles.get("instagram:12")).toEqual({ username: "new.name", name: "Deniz" });
  });
});

describe("ChannelIdentityService.updateProfile", () => {
  it("refreshes an existing identity", async () => {
    const { identities, service } = setup();
    await service.resolve("instagram", "13");
    expect(await service.updateProfile("instagram", "13", { username: "cem", name: null })).toBe(true);
    expect(identities.profiles.get("instagram:13")).toEqual({ username: "cem", name: null });
  });

  it("never brings back an erased person", async () => {
    const { auth, identities, service } = setup();
    expect(await service.updateProfile("instagram", "14", { username: "gone", name: null })).toBe(false);
    expect(auth.users.size).toBe(0);
    expect(identities.rows.size).toBe(0);
  });
});

describe("channelProfileSchema", () => {
  it("accepts Instagram usernames and rejects anything else", () => {
    expect(channelProfileSchema.safeParse({ username: "a.b_c9", name: "Ayşe" }).success).toBe(true);
    expect(channelProfileSchema.safeParse({ username: "has space", name: null }).success).toBe(false);
    expect(channelProfileSchema.safeParse({ username: "x".repeat(31), name: null }).success).toBe(false);
    expect(channelProfileSchema.safeParse({ username: "ok", name: "" }).success).toBe(false);
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
