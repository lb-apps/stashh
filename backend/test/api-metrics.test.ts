import { describe, expect, it } from "vitest";
import { ApiMetrics } from "../src/lib/api-metrics.js";

/** A clock the test moves by hand. */
function clock(start: string) {
  let now = new Date(start).getTime();
  return {
    now: () => new Date(now),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("ApiMetrics", () => {
  it("counts requests by route and status class and reports typical and slowest latency", () => {
    const metrics = new ApiMetrics(() => new Date("2026-10-14T12:00:00Z"));
    for (let ms = 1; ms <= 100; ms++) metrics.record("GET /api/v1/places", 200, ms);
    metrics.record("GET /api/v1/places", 404, 5);
    metrics.record("POST /api/v1/recognitions", 429, 2);
    metrics.record("POST /api/v1/recognitions", 503, 900);

    const snapshot = metrics.snapshot();
    expect(snapshot.totals).toEqual({ requests: 103, "2xx": 100, "3xx": 0, "4xx": 2, "5xx": 1, rate_limited: 1 });
    const places = snapshot.routes.find((r) => r.route === "GET /api/v1/places");
    expect(places).toMatchObject({ requests: 101, client_errors: 1, server_errors: 0 });
    expect(places?.p50_ms).toBeCloseTo(50, 0);
    expect(places?.p95_ms).toBeCloseTo(95, 0);
    const recognitions = snapshot.routes.find((r) => r.route === "POST /api/v1/recognitions");
    expect(recognitions).toMatchObject({ client_errors: 1, server_errors: 1, rate_limited: 1, last_error_at: "2026-10-14T12:00:00.000Z" });
    expect(snapshot.latency.p50_ms).toBeCloseTo(50, 0);
    expect(snapshot.since).toBe("2026-10-14T12:00:00.000Z");
  });

  it("keeps a bounded window of latencies per route", () => {
    const metrics = new ApiMetrics();
    for (let i = 0; i < 5_000; i++) metrics.record("GET /x", 200, i < 4_500 ? 1_000 : 1);
    // Only the most recent samples count, so recent speed is what shows.
    expect(metrics.snapshot().routes[0]?.p50_ms).toBe(1);
  });

  it("buckets traffic in 5 minutes since the process started, gaps as zeros", () => {
    const time = clock("2026-10-14T12:01:00Z");
    const metrics = new ApiMetrics(time.now);
    metrics.record("GET /x", 200, 10);
    metrics.record("GET /x", 500, 10);
    time.advance(11 * 60_000); // 12:12 — two buckets later
    metrics.record("GET /x", 404, 10);

    const series = metrics.snapshot().series;
    expect(series.map((p) => p.bucket)).toEqual(["2026-10-14T12:00:00.000Z", "2026-10-14T12:05:00.000Z", "2026-10-14T12:10:00.000Z"]);
    expect(series[0]).toMatchObject({ requests: 2, server_errors: 1, client_errors: 0 });
    expect(series[1]).toMatchObject({ requests: 0 });
    expect(series[2]).toMatchObject({ requests: 1, client_errors: 1 });
  });

  it("covers at most the last 24 hours and forgets older buckets", () => {
    const time = clock("2026-10-14T00:00:00Z");
    const metrics = new ApiMetrics(time.now);
    metrics.record("GET /x", 200, 10);
    time.advance(26 * 60 * 60_000);
    metrics.record("GET /x", 200, 10);

    const series = metrics.snapshot().series;
    expect(series).toHaveLength(288);
    expect(series.reduce((sum, p) => sum + p.requests, 0)).toBe(1);
  });

  it("keeps the last 25 server errors, newest first, with a bounded message", () => {
    const time = clock("2026-10-14T12:00:00Z");
    const metrics = new ApiMetrics(time.now);
    for (let i = 0; i < 30; i++) {
      metrics.record("POST /api/v1/recognitions", 502, 10, `upstream failed ${i}`);
      time.advance(1_000);
    }
    metrics.record("GET /x", 404, 10, "not found"); // client errors are not listed
    metrics.record("GET /x", 500, 10, "x".repeat(1_000));

    const errors = metrics.snapshot().recent_errors;
    expect(errors).toHaveLength(25);
    expect(errors[0]?.message).toHaveLength(300);
    expect(errors[1]).toMatchObject({ route: "POST /api/v1/recognitions", status: 502, message: "upstream failed 29" });
  });
});
