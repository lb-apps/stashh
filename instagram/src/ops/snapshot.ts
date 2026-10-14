import type { Db } from "../db/client.ts";
import type { ResolvedOpsRange } from "./range.ts";

/**
 * The channel's ops snapshot: what the database knows (`instagram_ops_stats`) plus
 * what only this process knows — messages in hand and how long it has been up.
 */
export function createOpsSnapshot(options: { db: Db; inFlight: () => number; startedAt: Date }) {
  return async ({ since, bucket }: ResolvedOpsRange) => {
    const { data, error } = await options.db.rpc("instagram_ops_stats", { p_since: since.toISOString(), p_bucket: bucket });
    if (error) throw new Error(`instagram_ops_stats failed: ${error.message}`);
    return {
      ...(data as Record<string, unknown>),
      process: { in_flight: options.inFlight(), started_at: options.startedAt.toISOString() },
    };
  };
}
