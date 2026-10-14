import type { Database } from "../../types/database.js";
import type { AIAnalysisResult } from "../../types/schemas.js";
import type { RunTimings } from "./task-logger.js";

export type RecognitionRunInsert = Database["public"]["Tables"]["recognition_runs"]["Insert"];

/** Worker step names → the run column that keeps their duration. */
const STEP_COLUMNS = {
  "content fetched": "fetch_ms",
  "media analyzed": "analysis_ms",
  "places found": "match_ms",
  "thumbnails saved": "thumbnails_ms",
  "result saved": "save_ms",
} as const;

export interface RunRecordInput {
  taskId: string;
  attempt: number;
  outcome: "completed" | "cache_hit" | "failed";
  timings: RunTimings;
  analysis?: Pick<AIAnalysisResult, "media_kind" | "media_bytes" | "model" | "provider" | "usage"> & { places_extracted: number };
  placesMatched?: number;
  errorMessage?: string;
}

/** One worker attempt as a `recognition_runs` row. */
export function buildRunRecord(input: RunRecordInput): RecognitionRunInsert {
  const { analysis, timings } = input;
  const step = (name: keyof typeof STEP_COLUMNS) => timings.steps[name] ?? null;

  return {
    task_id: input.taskId,
    attempt: input.attempt,
    outcome: input.outcome,
    failed_step: input.outcome === "failed" ? (timings.failedStep ?? "unknown") : null,
    error_message: input.errorMessage ?? null,
    started_at: timings.startedAt.toISOString(),
    total_ms: timings.totalMs,
    fetch_ms: step("content fetched"),
    analysis_ms: step("media analyzed"),
    match_ms: step("places found"),
    thumbnails_ms: step("thumbnails saved"),
    save_ms: step("result saved"),
    media_kind: analysis?.media_kind ?? null,
    media_bytes: analysis?.media_bytes ?? null,
    model: analysis?.model ?? null,
    provider: analysis?.provider ?? null,
    prompt_tokens: analysis?.usage?.prompt_tokens ?? null,
    completion_tokens: analysis?.usage?.completion_tokens ?? null,
    reasoning_tokens: analysis?.usage?.reasoning_tokens ?? null,
    cached_tokens: analysis?.usage?.cached_tokens ?? null,
    cost_usd: analysis?.usage?.cost_usd ?? null,
    places_extracted: analysis?.places_extracted ?? null,
    places_matched: input.placesMatched ?? null,
  };
}
