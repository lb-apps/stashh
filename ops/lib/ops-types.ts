/**
 * Payloads of the two services' ops endpoints, as the dashboard reads them.
 * Backend: GET /internal/v1/ops/recognitions (recognition_ops_stats()).
 * Instagram: GET /ops/stats (instagram_ops_stats()).
 * Percentiles and averages are null until there is data to compute them from.
 */

export const OPS_RANGES = ["24h", "7d", "30d"] as const;
export type OpsRange = (typeof OPS_RANGES)[number];

export const RANGE_LABELS: Record<OpsRange, string> = { "24h": "24 saat", "7d": "7 gün", "30d": "30 gün" };
/** For the header on phones. */
export const RANGE_SHORT_LABELS: Record<OpsRange, string> = { "24h": "24 sa", "7d": "7 g", "30d": "30 g" };

type Ms = number | null;

export interface RecognitionSeriesPoint {
  bucket: string;
  requests: number;
  completed: number;
  failed: number;
  cache_hits: number;
}

export interface RecognitionStats {
  live: { queued: number; processing: number; oldest_queued_at: string | null; oldest_processing_started_at: string | null };
  totals: { requests: number; completed: number; failed: number; cancelled: number; in_progress: number; retried: number };
  runs: {
    total: number;
    completed: number;
    cache_hits: number;
    failed: number;
    processing_p50_ms: Ms;
    processing_p95_ms: Ms;
    cache_p50_ms: Ms;
    steps_avg_ms: { fetch: Ms; analysis: Ms; match: Ms; thumbnails: Ms; save: Ms };
    places_extracted: number;
    places_matched: number;
    model_calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    reasoning_tokens: number;
    cost_usd: number;
  };
  wait: { p50_ms: Ms; p95_ms: Ms };
  series: RecognitionSeriesPoint[];
  failures_by_step: { step: string; count: number }[];
}

export interface QueueItem {
  id: string;
  source_url: string;
  status: "queued" | "processing";
  retry_count: number;
  created_at: string;
  started_at: string | null;
}

export interface RecognitionRun {
  id: string;
  task_id: string;
  attempt: number;
  outcome: "completed" | "cache_hit" | "failed";
  failed_step: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string;
  total_ms: number;
  fetch_ms: Ms;
  analysis_ms: Ms;
  match_ms: Ms;
  thumbnails_ms: Ms;
  save_ms: Ms;
  media_kind: "video" | "image" | null;
  model: string | null;
  cost_usd: number | null;
  places_extracted: number | null;
  places_matched: number | null;
  source_url: string | null;
}

export interface RecognitionOps {
  range: OpsRange;
  since: string;
  bucket: "hour" | "day";
  generated_at: string;
  stats: RecognitionStats;
  queue: QueueItem[];
  recent_runs: RecognitionRun[];
}

export interface InstagramSeriesPoint {
  bucket: string;
  messages: number;
  replied: number;
  failed: number;
}

export interface InstagramStats {
  live: { received: number; submitted: number; oldest_open_at: string | null };
  totals: { messages: number; senders: number; replied: number; failed: number; expired: number; open: number; retried: number };
  intents: { recognize: number; help: number; unsupported: number; erase: number; unknown: number };
  reply: { p50_ms: Ms; p95_ms: Ms };
  series: InstagramSeriesPoint[];
  recent_failures: { status: "failed" | "expired"; intent: string | null; attempts: number; last_error: string | null; finished_at: string }[];
  account: { expires_at: string | null; refreshed_at: string | null } | null;
  process: { in_flight: number; started_at: string };
}

export interface InstagramOps {
  range: OpsRange;
  since: string;
  bucket: "hour" | "day";
  generated_at: string;
  stats: InstagramStats;
}
