import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { buildRunRecord } from "../src/modules/recognitions/run-record.js";
import { createTaskLogger } from "../src/modules/recognitions/task-logger.js";

const log = pino({ level: "silent" });
const task = { id: "task-1", sourceUrl: "https://instagram.com/reel/A", retryCount: 0, bypassCache: false };

describe("task logger timings", () => {
  it("keeps every step's duration, including the one that failed", async () => {
    const tl = createTaskLogger(log, task);
    await tl.step("content fetched", async () => "ok");
    await expect(
      tl.step("media analyzed", async () => {
        throw new Error("model down");
      }),
    ).rejects.toThrow("model down");

    const timings = tl.timings();
    expect(Object.keys(timings.steps)).toEqual(["content fetched", "media analyzed"]);
    expect(timings.failedStep).toBe("media analyzed");
    expect(timings.totalMs).toBeGreaterThanOrEqual(0);
    expect(timings.startedAt).toBeInstanceOf(Date);
  });

  it("has no failed step after a clean run", async () => {
    const tl = createTaskLogger(log, task);
    await tl.step("cache checked", async () => null);
    expect(tl.timings().failedStep).toBeNull();
  });
});

describe("buildRunRecord", () => {
  const timings = {
    startedAt: new Date("2026-10-14T12:00:00Z"),
    totalMs: 12_000,
    steps: { "content fetched": 2_000, "media analyzed": 8_000, "places found": 700, "thumbnails saved": 900, "result saved": 400 },
    failedStep: null,
  };

  it("records a full run with step split, model usage and match counts", () => {
    const record = buildRunRecord({
      taskId: "task-1",
      attempt: 1,
      outcome: "completed",
      timings,
      analysis: {
        media_kind: "image",
        media_bytes: 172_323,
        model: "google/gemini-3.8-flash",
        provider: "Google AI Studio",
        usage: { prompt_tokens: 1_200, completion_tokens: 300, reasoning_tokens: 120, cached_tokens: 0, cost_usd: 0.0021 },
        places_extracted: 6,
      },
      placesMatched: 6,
    });

    expect(record).toEqual({
      task_id: "task-1",
      attempt: 1,
      outcome: "completed",
      failed_step: null,
      error_message: null,
      started_at: "2026-10-14T12:00:00.000Z",
      total_ms: 12_000,
      fetch_ms: 2_000,
      analysis_ms: 8_000,
      match_ms: 700,
      thumbnails_ms: 900,
      save_ms: 400,
      media_kind: "image",
      media_bytes: 172_323,
      model: "google/gemini-3.8-flash",
      provider: "Google AI Studio",
      prompt_tokens: 1_200,
      completion_tokens: 300,
      reasoning_tokens: 120,
      cached_tokens: 0,
      cost_usd: 0.0021,
      places_extracted: 6,
      places_matched: 6,
    });
  });

  it("records a cache hit with only its total time", () => {
    const record = buildRunRecord({
      taskId: "task-2",
      attempt: 1,
      outcome: "cache_hit",
      timings: { startedAt: timings.startedAt, totalMs: 300, steps: { "cache checked": 120, "served from cache": 180 }, failedStep: null },
    });
    expect(record).toMatchObject({ outcome: "cache_hit", total_ms: 300, fetch_ms: null, analysis_ms: null, model: null, cost_usd: null });
  });

  it("records a failure with the step it stopped at", () => {
    const record = buildRunRecord({
      taskId: "task-3",
      attempt: 2,
      outcome: "failed",
      timings: { ...timings, steps: { "content fetched": 1_500 }, failedStep: "content fetched" },
      errorMessage: "Could not extract video URL",
    });
    expect(record).toMatchObject({
      attempt: 2,
      outcome: "failed",
      failed_step: "content fetched",
      error_message: "Could not extract video URL",
      fetch_ms: 1_500,
      analysis_ms: null,
    });
  });
});
