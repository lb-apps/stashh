import type { RequestHandler } from "express";

/** Latencies kept per route, so the typical and slowest times describe recent traffic. */
const WINDOW = 500;
/** The traffic series: 5-minute buckets covering the last 24 hours. */
const BUCKET_MS = 5 * 60_000;
const BUCKETS = 288;
/** Server errors kept for the ops dashboard, newest first. */
const RECENT_ERRORS = 25;
const MESSAGE_LIMIT = 300;

interface RouteStats {
  requests: number;
  clientErrors: number;
  serverErrors: number;
  rateLimited: number;
  lastErrorAt: number | null;
  latencies: number[];
  next: number;
}

interface Bucket {
  start: number;
  requests: number;
  client_errors: number;
  server_errors: number;
  rate_limited: number;
}

export interface ServerError {
  at: string;
  route: string;
  status: number;
  message: string | null;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = p * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (rank - low);
}

/**
 * In-memory API health for the ops dashboard: request counts by status class, latency per
 * route, a 24-hour series in 5-minute buckets and the last server errors — all since this
 * process started. Nothing is persisted: it describes this instance, and a restart starts
 * it over. No request bodies or user ids are kept.
 */
export class ApiMetrics {
  private readonly routes = new Map<string, RouteStats>();
  private readonly totals = { requests: 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, rate_limited: 0 };
  private readonly buckets: Array<Bucket | undefined> = new Array(BUCKETS);
  private readonly recentErrors: ServerError[] = [];
  /** Recent latencies across every route, for the API's overall typical and slowest times. */
  private readonly latencies: number[] = [];
  private nextLatency = 0;
  private readonly since: Date;

  constructor(private readonly now: () => Date = () => new Date()) {
    this.since = now();
  }

  record(route: string, status: number, durationMs: number, errorMessage: string | null = null): void {
    const at = this.now().getTime();
    this.totals.requests += 1;
    const statusClass = `${Math.floor(status / 100)}xx` as "2xx" | "3xx" | "4xx" | "5xx";
    if (statusClass in this.totals) this.totals[statusClass] += 1;
    if (status === 429) this.totals.rate_limited += 1;

    let stats = this.routes.get(route);
    if (!stats) {
      stats = { requests: 0, clientErrors: 0, serverErrors: 0, rateLimited: 0, lastErrorAt: null, latencies: [], next: 0 };
      this.routes.set(route, stats);
    }
    stats.requests += 1;
    if (status >= 400 && status < 500) stats.clientErrors += 1;
    if (status >= 500) stats.serverErrors += 1;
    if (status === 429) stats.rateLimited += 1;
    if (status >= 400) stats.lastErrorAt = at;
    if (stats.latencies.length < WINDOW) stats.latencies.push(durationMs);
    else stats.latencies[stats.next] = durationMs;
    stats.next = (stats.next + 1) % WINDOW;

    if (this.latencies.length < WINDOW * 2) this.latencies.push(durationMs);
    else this.latencies[this.nextLatency] = durationMs;
    this.nextLatency = (this.nextLatency + 1) % (WINDOW * 2);

    const bucket = this.bucketAt(at);
    bucket.requests += 1;
    if (status >= 400 && status < 500) bucket.client_errors += 1;
    if (status >= 500) bucket.server_errors += 1;
    if (status === 429) bucket.rate_limited += 1;

    if (status >= 500) {
      this.recentErrors.unshift({
        at: new Date(at).toISOString(),
        route,
        status,
        message: errorMessage ? errorMessage.slice(0, MESSAGE_LIMIT) : null,
      });
      this.recentErrors.length = Math.min(this.recentErrors.length, RECENT_ERRORS);
    }
  }

  /** The bucket for `at`, reset if the ring slot still holds a bucket from a day ago. */
  private bucketAt(at: number): Bucket {
    const start = Math.floor(at / BUCKET_MS) * BUCKET_MS;
    const slot = (start / BUCKET_MS) % BUCKETS;
    let bucket = this.buckets[slot];
    if (!bucket || bucket.start !== start) {
      bucket = { start, requests: 0, client_errors: 0, server_errors: 0, rate_limited: 0 };
      this.buckets[slot] = bucket;
    }
    return bucket;
  }

  /** Every 5-minute bucket from this process's start (at most 24 hours back) to now, gaps as zeros. */
  private series() {
    const now = this.now().getTime();
    const last = Math.floor(now / BUCKET_MS) * BUCKET_MS;
    const first = Math.max(last - (BUCKETS - 1) * BUCKET_MS, Math.floor(this.since.getTime() / BUCKET_MS) * BUCKET_MS);
    const points = [];
    for (let start = first; start <= last; start += BUCKET_MS) {
      const bucket = this.buckets[(start / BUCKET_MS) % BUCKETS];
      const live = bucket && bucket.start === start ? bucket : null;
      points.push({
        bucket: new Date(start).toISOString(),
        requests: live?.requests ?? 0,
        client_errors: live?.client_errors ?? 0,
        server_errors: live?.server_errors ?? 0,
        rate_limited: live?.rate_limited ?? 0,
      });
    }
    return points;
  }

  snapshot() {
    const all = [...this.latencies].sort((a, b) => a - b);
    return {
      since: this.since.toISOString(),
      totals: { ...this.totals },
      latency: { p50_ms: percentile(all, 0.5), p95_ms: percentile(all, 0.95) },
      routes: [...this.routes.entries()]
        .map(([route, stats]) => {
          const sorted = [...stats.latencies].sort((a, b) => a - b);
          return {
            route,
            requests: stats.requests,
            client_errors: stats.clientErrors,
            server_errors: stats.serverErrors,
            rate_limited: stats.rateLimited,
            last_error_at: stats.lastErrorAt ? new Date(stats.lastErrorAt).toISOString() : null,
            p50_ms: percentile(sorted, 0.5),
            p95_ms: percentile(sorted, 0.95),
          };
        })
        .sort((a, b) => b.requests - a.requests),
      series: this.series(),
      recent_errors: [...this.recentErrors],
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
      const message = typeof res.locals.errorMessage === "string" ? res.locals.errorMessage : null;
      metrics.record(`${req.method} ${pattern}`, res.statusCode, Math.round(performance.now() - started), message);
    });
    next();
  };
}

export const apiMetrics = new ApiMetrics();
