import { describe, expect, it } from "vitest";
import { ApiMetrics } from "../src/lib/api-metrics.js";

describe("ApiMetrics", () => {
  it("counts requests by route and status class and reports latency percentiles", () => {
    const metrics = new ApiMetrics(() => new Date("2026-10-14T12:00:00Z"));
    for (let ms = 1; ms <= 100; ms++) metrics.record("GET /api/v1/places", 200, ms);
    metrics.record("GET /api/v1/places", 404, 5);
    metrics.record("POST /api/v1/recognitions", 429, 2);
    metrics.record("POST /api/v1/recognitions", 503, 900);

    const snapshot = metrics.snapshot();
    expect(snapshot.totals).toEqual({ requests: 103, "2xx": 100, "3xx": 0, "4xx": 2, "5xx": 1, rate_limited: 1 });
    const places = snapshot.routes.find((r) => r.route === "GET /api/v1/places");
    expect(places).toMatchObject({ requests: 101, errors: 1 });
    expect(places?.p50_ms).toBeCloseTo(50, 0);
    expect(places?.p95_ms).toBeCloseTo(95, 0);
    expect(snapshot.since).toBe("2026-10-14T12:00:00.000Z");
  });

  it("keeps a bounded window of latencies per route", () => {
    const metrics = new ApiMetrics();
    for (let i = 0; i < 5_000; i++) metrics.record("GET /x", 200, i < 4_500 ? 1_000 : 1);
    // Only the most recent samples count, so recent speed is what shows.
    expect(metrics.snapshot().routes[0]?.p50_ms).toBe(1);
  });
});
