import { describe, expect, it } from "vitest";
import { opsQuerySchema, resolveOpsRange } from "../src/modules/ops/types.js";

describe("ops range", () => {
  const now = new Date("2026-10-14T12:30:00Z");

  it("defaults to the last 24 hours in hourly buckets", () => {
    const query = opsQuerySchema.parse({});
    expect(resolveOpsRange(query.range, now)).toEqual({ range: "24h", since: new Date("2026-10-13T12:30:00Z"), bucket: "hour" });
  });

  it.each([
    ["7d", "2026-10-07T12:30:00Z"],
    ["30d", "2026-09-14T12:30:00Z"],
  ] as const)("uses daily buckets for %s", (range, since) => {
    expect(resolveOpsRange(range, now)).toEqual({ range, since: new Date(since), bucket: "day" });
  });

  it("rejects anything else", () => {
    expect(opsQuerySchema.safeParse({ range: "1y" }).success).toBe(false);
  });
});
