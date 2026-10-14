-- Ops stats for recognitions, in one round trip.
--
-- Read by the backend's internal ops endpoint (service role only). Window figures
-- cover tasks created and runs finished since p_since; `live` is the queue right now.
-- Runs exist from 2026-10-14 on, so run-based figures (cache hits, steps, cost) start
-- there while task-based ones cover all history.

create function public.recognition_ops_stats(p_since timestamptz, p_bucket text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  tasks as (
    select t.* from public.recognition_tasks t where t.created_at >= p_since
  ),
  runs as (
    select r.* from public.recognition_runs r where r.finished_at >= p_since
  ),
  first_runs as (
    select distinct on (r.task_id) r.task_id, r.started_at
    from public.recognition_runs r
    join tasks t on t.id = r.task_id
    order by r.task_id, r.started_at
  ),
  waits as (
    select extract(epoch from (f.started_at - t.created_at)) * 1000 as wait_ms
    from first_runs f
    join tasks t on t.id = f.task_id
  ),
  buckets as (
    select generate_series(
      date_trunc(p_bucket, p_since),
      date_trunc(p_bucket, now()),
      ('1 ' || p_bucket)::interval
    ) as bucket
  ),
  series as (
    select
      b.bucket,
      count(t.id) as requests,
      count(t.id) filter (where t.status in ('completed', 'committed')) as completed,
      count(t.id) filter (where t.status = 'failed') as failed,
      count(t.id) filter (where exists (
        select 1 from public.recognition_runs r where r.task_id = t.id and r.outcome = 'cache_hit'
      )) as cache_hits
    from buckets b
    left join tasks t on date_trunc(p_bucket, t.created_at) = b.bucket
    group by b.bucket
  )
  select jsonb_build_object(
    'live', (
      select jsonb_build_object(
        'queued', count(*) filter (where status = 'queued'),
        'processing', count(*) filter (where status = 'processing'),
        'oldest_queued_at', min(created_at) filter (where status = 'queued'),
        'oldest_processing_started_at', min(started_at) filter (where status = 'processing')
      )
      from public.recognition_tasks
      where status in ('queued', 'processing')
    ),
    'totals', (
      select jsonb_build_object(
        'requests', count(*),
        'completed', count(*) filter (where status in ('completed', 'committed')),
        'failed', count(*) filter (where status = 'failed'),
        'cancelled', count(*) filter (where status in ('cancelled', 'expired')),
        'in_progress', count(*) filter (where status in ('queued', 'processing')),
        'retried', count(*) filter (where retry_count > 0)
      )
      from tasks
    ),
    'runs', (
      select jsonb_build_object(
        'total', count(*),
        'completed', count(*) filter (where outcome = 'completed'),
        'cache_hits', count(*) filter (where outcome = 'cache_hit'),
        'failed', count(*) filter (where outcome = 'failed'),
        'processing_p50_ms', percentile_cont(0.5) within group (order by total_ms) filter (where outcome = 'completed'),
        'processing_p95_ms', percentile_cont(0.95) within group (order by total_ms) filter (where outcome = 'completed'),
        'cache_p50_ms', percentile_cont(0.5) within group (order by total_ms) filter (where outcome = 'cache_hit'),
        'steps_avg_ms', jsonb_build_object(
          'fetch', round(avg(fetch_ms) filter (where outcome = 'completed')),
          'analysis', round(avg(analysis_ms) filter (where outcome = 'completed')),
          'match', round(avg(match_ms) filter (where outcome = 'completed')),
          'thumbnails', round(avg(thumbnails_ms) filter (where outcome = 'completed')),
          'save', round(avg(save_ms) filter (where outcome = 'completed'))
        ),
        'places_extracted', coalesce(sum(places_extracted), 0),
        'places_matched', coalesce(sum(places_matched), 0),
        'model_calls', count(*) filter (where model is not null),
        'prompt_tokens', coalesce(sum(prompt_tokens), 0),
        'completion_tokens', coalesce(sum(completion_tokens), 0),
        'reasoning_tokens', coalesce(sum(reasoning_tokens), 0),
        'cost_usd', coalesce(sum(cost_usd), 0)
      )
      from runs
    ),
    'wait', (
      select jsonb_build_object(
        'p50_ms', percentile_cont(0.5) within group (order by wait_ms),
        'p95_ms', percentile_cont(0.95) within group (order by wait_ms)
      )
      from waits
    ),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'requests', requests,
        'completed', completed,
        'failed', failed,
        'cache_hits', cache_hits
      ) order by bucket), '[]'::jsonb)
      from series
    ),
    'failures_by_step', (
      select coalesce(jsonb_agg(jsonb_build_object('step', failed_step, 'count', n) order by n desc), '[]'::jsonb)
      from (select failed_step, count(*) as n from runs where outcome = 'failed' group by failed_step) f
    )
  );
$$;

revoke execute on function public.recognition_ops_stats(timestamptz, text) from public, anon, authenticated;
grant execute on function public.recognition_ops_stats(timestamptz, text) to service_role;
