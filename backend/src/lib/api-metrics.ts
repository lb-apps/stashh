import type { RequestHandler } from "express";

/** Latencies kept per route, so percentiles describe recent traffic rather than all time. */
const WINDOW = 500;

interface RouteStats {
  requests: number;
  errors: number;
  latencies: number[];
  next: number;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = p * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (rank - low);
}

/**
 * In-memory API health for the ops dashboard: request counts by status class and latency
 * percentiles per route since this process started. Nothing is persisted — it describes
 * this instance, and a restart starts it over.
 */
export class ApiMetrics {
  private readonly routes = new Map<string, RouteStats>();
  private readonly totals = { requests: 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, rate_limited: 0 };
  private readonly since: Date;

  constructor(now: () => Date = () => new Date()) {
    this.since = now();
  }

  record(route: string, status: number, durationMs: number): void {
    this.totals.requests += 1;
    const statusClass = `${Math.floor(status / 100)}xx` as "2xx" | "3xx" | "4xx" | "5xx";
    if (statusClass in this.totals) this.totals[statusClass] += 1;
    if (status === 429) this.totals.rate_limited += 1;

    let stats = this.routes.get(route);
    if (!stats) {
      stats = { requests: 0, errors: 0, latencies: [], next: 0 };
      this.routes.set(route, stats);
    }
    stats.requests += 1;
    if (status >= 400) stats.errors += 1;
    if (stats.latencies.length < WINDOW) stats.latencies.push(durationMs);
    else stats.latencies[stats.next] = durationMs;
    stats.next = (stats.next + 1) % WINDOW;
  }

  snapshot() {
    return {
      since: this.since.toISOString(),
      totals: { ...this.totals },
      routes: [...this.routes.entries()]
        .map(([route, stats]) => {
          const sorted = [...stats.latencies].sort((a, b) => a - b);
          return {
            route,
            requests: stats.requests,
            errors: stats.errors,
            p50_ms: percentile(sorted, 0.5),
            p95_ms: percentile(sorted, 0.95),
          };
        })
        .sort((a, b) => b.requests - a.requests),
    };
  }
}

/**
 * Records every request under its route pattern (`GET /api/v1/places/:id`, not the raw
 * URL). The ops endpoints and health checks are skipped so the dashboard's own polling
 * does not drown out real traffic.
 */
export function apiMetricsMiddleware(metrics: ApiMetrics, skip: (path: string) => boolean): RequestHandler {
  return (req, res, next) => {
    if (skip(req.path)) {
      next();
      return;
    }
    const started = performance.now();
    res.on("finish", () => {
      const pattern = req.route?.path ? `${req.baseUrl}${String(req.route.path)}` : req.baseUrl || "unmatched";
      metrics.record(`${req.method} ${pattern}`, res.statusCode, Math.round(performance.now() - started));
    });
    next();
  };
}

export const apiMetrics = new ApiMetrics();
