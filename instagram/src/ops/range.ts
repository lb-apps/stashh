import { z } from "zod";

/** Windows the ops dashboard offers (the same three as the backend's ops endpoint). */
export const OPS_RANGES = ["24h", "7d", "30d"] as const;
export type OpsRange = (typeof OPS_RANGES)[number];

export const opsQuerySchema = z.object({ range: z.enum(OPS_RANGES).default("24h") });

const HOUR_MS = 60 * 60 * 1000;
const RANGE_MS: Record<OpsRange, number> = { "24h": 24 * HOUR_MS, "7d": 7 * 24 * HOUR_MS, "30d": 30 * 24 * HOUR_MS };

export interface ResolvedOpsRange {
  range: OpsRange;
  since: Date;
  bucket: "hour" | "day";
}

export function resolveOpsRange(range: OpsRange, now: Date = new Date()): ResolvedOpsRange {
  return { range, since: new Date(now.getTime() - RANGE_MS[range]), bucket: range === "24h" ? "hour" : "day" };
}
