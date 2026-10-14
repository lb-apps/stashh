/**
 * Payloads of the two services' ops endpoints, as the dashboard reads them.
 * Backend: GET /internal/v1/ops/recognitions (+ /:id) — recognition_ops_stats / _list / _detail.
 * Instagram: GET /ops/stats — instagram_ops_stats.
 * Percentiles and averages are null until there is data to compute them from.
 */

export const OPS_RANGES = ["24h", "7d", "30d"] as const;
export type OpsRange = (typeof OPS_RANGES)[number];

export const RANGE_LABELS: Record<OpsRange, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };
/** For the header on phones. */
export const RANGE_SHORT_LABELS: Record<OpsRange, string> = { "24h": "24h", "7d": "7d", "30d": "30d" };
export const PREVIOUS_LABELS: Record<OpsRange, string> = { "24h": "vs the previous 24 hours", "7d": "vs the previous 7 days", "30d": "vs the previous 30 days" };

type Ms = number | null;

export type SourceType = "reel" | "post" | "igtv" | "tiktok" | "shared_post";
export type Channel = "app" | "instagram";
export type TaskStatus = "queued" | "processing" | "completed" | "committed" | "failed" | "cancelled" | "expired";
export type RunOutcome = "completed" | "cache_hit" | "failed";
export type FetchMethod = "scrape" | "downloader" | "tiktok" | "supplied";

export interface RecognitionSeriesPoint {
  bucket: string;
  requests: number;
  completed: number;
  failed: number;
  cache_hits: number;
  processing_p50_ms: Ms;
  processing_p95_ms: Ms;
  wait_p50_ms: Ms;
  cost_usd: number;
  tokens: number;
  fetch_ms: Ms;
  analysis_ms: Ms;
  match_ms: Ms;
  thumbnails_ms: Ms;
}

export interface RecognitionStats {
  live: { queued: number; processing: number; oldest_queued_at: string | null; oldest_processing_started_at: string | null };
  totals: {
    requests: number;
    completed: number;
    failed: number;
    cancelled: number;
    in_progress: number;
    retried: number;
    recovered: number;
    active_users: number;
    unique_sources: number;
  };
  previous: {
    requests: number;
    completed: number;
    failed: number;
    active_users: number;
    cache_hits: number;
    completed_runs: number;
    zero_results: number;
    cost_usd: number;
    processing_p50_ms: Ms;
  };
  runs: {
    total: number;
    completed: number;
    cache_hits: number;
    failed: number;
    zero_results: number;
    processing_p50_ms: Ms;
    processing_p95_ms: Ms;
    cache_p50_ms: Ms;
    model_p50_ms: Ms;
    model_p95_ms: Ms;
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
  top_errors: { message: string; step: string; count: number }[];
  source_mix: { type: SourceType; count: number }[];
  channel_mix: { channel: Channel; count: number; users: number }[];
  fetch_methods: { method: FetchMethod; count: number; failed: number }[];
  users: { total: number; new: number; new_instagram: number };
  library: { saved_places: number; lists_created: number; list_additions: number; catalog_places: number; catalog_new: number };
  top_places: { google_place_id: string; name: string; thumbnail_url: string | null; rating: number | null; count: number }[];
}

export interface QueueItem {
  id: string;
  source_url: string;
  status: "queued" | "processing";
  retry_count: number;
  created_at: string;
  started_at: string | null;
}

export interface RecognitionListItem {
  id: string;
  source_url: string;
  source_type: SourceType;
  channel: Channel;
  status: TaskStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  places_count: number;
  place_names: string[] | null;
  runs: number;
  last_outcome: RunOutcome | null;
  total_ms: Ms;
  cost_usd: number | null;
}

export interface ApiRouteHealth {
  route: string;
  requests: number;
  errors: number;
  p50_ms: Ms;
  p95_ms: Ms;
}

export interface RecognitionOps {
  range: OpsRange;
  since: string;
  bucket: "hour" | "day";
  generated_at: string;
  stats: RecognitionStats;
  queue: QueueItem[];
  recognitions: RecognitionListItem[];
  process: {
    started_at: string;
    memory_mb: number;
    worker_concurrency: number;
    model: string;
    api: {
      since: string;
      totals: { requests: number; "2xx": number; "3xx": number; "4xx": number; "5xx": number; rate_limited: number };
      routes: ApiRouteHealth[];
    };
  };
}

export interface RecognitionPlace {
  google_place_id: string;
  name: string;
  address?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  category?: string | null;
  district?: string | null;
  thumbnail_url?: string | null;
  instagram_username?: string | null;
  google_maps_uri?: string | null;
  recommendations?: { summary: string; kind: string }[];
}

export interface RecognitionRunDetail {
  id: string;
  attempt: number;
  outcome: RunOutcome;
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
  fetch_method: FetchMethod | null;
  media_kind: "video" | "image" | null;
  media_bytes: number | null;
  model: string | null;
  provider: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  reasoning_tokens: number | null;
  cached_tokens: number | null;
  cost_usd: number | null;
  places_extracted: number | null;
  places_matched: number | null;
}

export interface RecognitionDetail {
  id: string;
  source_url: string;
  source_type: SourceType;
  channel: Channel;
  owner_user_id: string;
  status: TaskStatus;
  retry_count: number;
  error_message: string | null;
  idempotency_key: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  source: { caption: string | null; thumbnail_url: string | null; video_url: string | null; source_type: string | null; result_created_at: string } | null;
  places: RecognitionPlace[];
  runs: RecognitionRunDetail[];
}

export type DmContent = "reel" | "post" | "link" | "text" | "other";

export interface InstagramSeriesPoint {
  bucket: string;
  messages: number;
  replied: number;
  failed: number;
  reply_p50_ms: Ms;
}

export interface InstagramStats {
  live: { received: number; submitted: number; oldest_open_at: string | null };
  totals: { messages: number; senders: number; replied: number; failed: number; expired: number; open: number; retried: number };
  previous: { messages: number; senders: number; replied: number; unanswered: number; reply_p50_ms: Ms };
  intents: { recognize: number; help: number; unsupported: number; erase: number; unknown: number };
  content_mix: { content: DmContent; count: number }[];
  outcomes: { with_places: number; no_places: number; apology: number; expired: number };
  senders: { new: number; returning: number };
  reply: { p50_ms: Ms; p95_ms: Ms };
  series: InstagramSeriesPoint[];
  recent_failures: { status: "failed" | "expired"; intent: string | null; content: DmContent; attempts: number; last_error: string | null; finished_at: string }[];
  account: { expires_at: string | null; refreshed_at: string | null } | null;
  process: {
    in_flight: number;
    started_at: string;
    webhooks: {
      since: string;
      deliveries: number;
      rejected_signature: number;
      ignored_envelope: number;
      messages_queued: number;
      messages_duplicate: number;
      other_account: number;
    };
  };
}

export interface InstagramOps {
  range: OpsRange;
  since: string;
  bucket: "hour" | "day";
  generated_at: string;
  stats: InstagramStats;
}
