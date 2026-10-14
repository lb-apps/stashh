-- Recognition runs: one row per worker attempt at a recognition task.
--
-- recognition_tasks says where a task is; it cannot say how the work went. Each
-- attempt — a cache hit, a full run or a failure — leaves a row here with its step
-- timings, model usage and cost and how many places it found, so the ops dashboard
-- can show where time and money go. Append-only. Rows follow their task on delete,
-- so erasing a user erases their runs.

create table public.recognition_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.recognition_tasks (id) on delete cascade,
  attempt integer not null check (attempt >= 1),
  outcome text not null check (outcome in ('completed', 'cache_hit', 'failed')),
  failed_step text,
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  total_ms integer not null check (total_ms >= 0),
  fetch_ms integer check (fetch_ms >= 0),
  analysis_ms integer check (analysis_ms >= 0),
  match_ms integer check (match_ms >= 0),
  thumbnails_ms integer check (thumbnails_ms >= 0),
  save_ms integer check (save_ms >= 0),
  media_kind text check (media_kind in ('video', 'image')),
  media_bytes integer check (media_bytes >= 0),
  model text,
  provider text,
  prompt_tokens integer check (prompt_tokens >= 0),
  completion_tokens integer check (completion_tokens >= 0),
  reasoning_tokens integer check (reasoning_tokens >= 0),
  cached_tokens integer check (cached_tokens >= 0),
  -- OpenRouter `usage.cost`, in USD credits.
  cost_usd numeric(12, 8) check (cost_usd >= 0),
  places_extracted integer check (places_extracted >= 0),
  places_matched integer check (places_matched >= 0),
  check (outcome <> 'failed' or failed_step is not null)
);

comment on table public.recognition_runs is
  'One row per worker attempt at a recognition task: outcome, step timings, model usage and cost. Written by the backend worker (service role); read by the ops stats.';

create index recognition_runs_finished_at_idx on public.recognition_runs (finished_at);
create index recognition_runs_task_id_idx on public.recognition_runs (task_id);

alter table public.recognition_runs enable row level security;
