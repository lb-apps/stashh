import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { GraphApiError, toProfile } from "../src/meta/graph-client.ts";
import { PROFILE_MAX_AGE_MS, sweepProfiles } from "../src/profiles/sweep.ts";
import { FakeProfiles, FakeStashh } from "./support/fakes.ts";

const log = pino({ level: "silent" });

describe("toProfile", () => {
  it("keeps a valid username and a trimmed name", () => {
    expect(toProfile({ id: "1", username: "ayse.k", name: "  Ayşe K  " })).toEqual({ username: "ayse.k", name: "Ayşe K" });
  });

  it("stores no name when the person has none", () => {
    expect(toProfile({ username: "cem" })).toEqual({ username: "cem", name: null });
    expect(toProfile({ username: "cem", name: "   " })).toEqual({ username: "cem", name: null });
  });

  it("is null without a username the backend would accept", () => {
    expect(toProfile({ name: "Ayşe" })).toBeNull();
    expect(toProfile({ username: "not valid" })).toBeNull();
    expect(toProfile(null)).toBeNull();
  });

  it("caps a long name to what the backend stores", () => {
    const name = toProfile({ username: "x", name: "🌮".repeat(150) })?.name ?? "";
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith("…")).toBe(true);
  });
});

describe("sweepProfiles", () => {
  it("stores the profile of every stale sender, page by page", async () => {
    const stashh = new FakeStashh();
    const profiles = new FakeProfiles();
    for (let i = 0; i < 150; i++) {
      const id = String(1000 + i);
      stashh.users.set(id, null);
      profiles.answers.set(id, { username: `user${i}`, name: null });
    }
    const now = new Date("2026-10-20T12:00:00Z");

    expect(await sweepProfiles({ stashh, profiles, log, now: () => now })).toBe(150);
    expect(stashh.users.get("1149")).toEqual({ username: "user149", name: null });
    expect(stashh.listCalls.map((c) => c.after)).toEqual([undefined, "1099"]);
    expect(stashh.listCalls[0]?.syncedBefore).toEqual(new Date(now.getTime() - PROFILE_MAX_AGE_MS));
  });

  it("skips senders Meta no longer answers for and carries on", async () => {
    const stashh = new FakeStashh();
    const profiles = new FakeProfiles();
    stashh.users.set("1", null).set("2", null).set("3", null);
    profiles.answers.set("1", new GraphApiError(400, 100, "Unsupported get request"));
    profiles.answers.set("2", null);
    profiles.answers.set("3", { username: "deniz", name: "Deniz" });

    expect(await sweepProfiles({ stashh, profiles, log })).toBe(1);
    expect(profiles.reads).toEqual(["1", "2", "3"]);
    expect(stashh.users.get("1")).toBeNull();
  });

  it("stops at throttling and leaves the rest for the next sweep", async () => {
    const stashh = new FakeStashh();
    const profiles = new FakeProfiles();
    stashh.users.set("1", null).set("2", null).set("3", null);
    profiles.answers.set("1", { username: "a", name: null });
    profiles.answers.set("2", new GraphApiError(400, 4, "Application request limit reached"));

    expect(await sweepProfiles({ stashh, profiles, log })).toBe(1);
    expect(profiles.reads).toEqual(["1", "2"]);
  });

  it("never creates a user for a sender who was erased mid-sweep", async () => {
    const stashh = new FakeStashh();
    const profiles = new FakeProfiles();
    stashh.users.set("1", null);
    profiles.answers.set("1", { username: "gone", name: null });
    const listed = stashh.listProfileStaleInstagramUsers.bind(stashh);
    stashh.listProfileStaleInstagramUsers = async (params) => {
      const page = await listed(params);
      stashh.users.delete("1");
      return page;
    };

    expect(await sweepProfiles({ stashh, profiles, log })).toBe(0);
    expect(stashh.resolved).toEqual([]);
    expect(stashh.users.size).toBe(0);
  });
});
