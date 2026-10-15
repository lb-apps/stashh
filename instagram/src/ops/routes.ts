import { Router } from "express";
import { requireBearerToken } from "../http/token-auth.ts";
import { opsQuerySchema, resolveOpsRange, type ResolvedOpsRange } from "./range.ts";

export interface OpsDeps {
  /** Accepted bearer tokens; the route is not mounted without any. */
  tokens: readonly string[];
  snapshot: (range: ResolvedOpsRange) => Promise<unknown>;
}

/** What the channel is doing, for the local ops dashboard. */
export function createOpsRouter({ tokens, snapshot }: OpsDeps): Router {
  const router = Router();
  router.use(requireBearerToken(tokens));

  router.get("/stats", async (req, res, next) => {
    const query = opsQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "range must be one of 24h, 7d, 30d" });
      return;
    }
    try {
      const range = resolveOpsRange(query.data.range);
      res.json({
        range: range.range,
        since: range.since.toISOString(),
        bucket: range.bucket,
        generated_at: new Date().toISOString(),
        stats: await snapshot(range),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
