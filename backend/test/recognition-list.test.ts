import { describe, expect, it } from "vitest";
import { presentRecognition, presentRecognitionSummary } from "../src/modules/recognitions/presenter.js";
import type { RecognitionTaskRow } from "../src/modules/recognitions/types.js";

const task = {
  id: "task-1",
  status: "processing",
  stage: "analyzing",
  source_url: "https://instagram.com/reel/DQ1",
  result_id: null,
  created_at: "2026-11-01T10:00:00Z",
  finished_at: null,
};

describe("presentRecognitionSummary", () => {
  it("shows a running recognition with its live stage and nothing found yet", () => {
    expect(presentRecognitionSummary({ task, result: null })).toEqual({
      recognition_id: "task-1",
      status: "processing",
      stage: "analyzing",
      source_url: "https://instagram.com/reel/DQ1",
      source_type: null,
      source_thumbnail_url: null,
      author_username: null,
      result_id: null,
      place_count: 0,
      created_at: "2026-11-01T10:00:00Z",
      finished_at: null,
    });
  });

  it("shows a finished one with its cover, author and count, and hides a shared post's internal key", () => {
    const summary = presentRecognitionSummary({
      task: { ...task, status: "completed", stage: "saving", source_url: "instagram-media:178", result_id: "r-1", finished_at: "2026-11-01T10:00:40Z" },
      result: { source_type: "post", source_thumbnail_url: "https://cdn/c.jpg", author_username: null, place_count: 3 },
    });
    expect(summary).toMatchObject({ source_url: null, source_type: "post", source_thumbnail_url: "https://cdn/c.jpg", place_count: 3, result_id: "r-1" });
  });
});

describe("presentRecognition", () => {
  it("returns the task's stage", () => {
    const row = { ...task, retry_count: 0, error_message: null, started_at: null, updated_at: task.created_at } as unknown as RecognitionTaskRow;
    expect(presentRecognition({ task: row, places: null, names_elsewhere: false }).stage).toBe("analyzing");
  });
});
