-- Recognition list and detail for the ops back office, and the two classifications they
-- share with recognition_ops_stats (re-created here to use them instead of inline copies).

-- What a source is, from its key: a Reel, a feed post, IGTV, a TikTok video, or a post
-- shared in an Instagram DM (keyed instagram-media:<id>).
create function public.recognition_source_type(p_source_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_source_url like 'instagram-media:%' then 'shared_post'
    when p_source_url ~* 'tiktok\.com' then 'tiktok'
    when p_source_url ~* '/reels?/' then 'reel'
    when p_source_url ~* '/tv/' then 'igtv'
    else 'post'
  end;
$$;

-- Where a request came from: a user created by a messaging channel, or the app.
create function public.recognition_channel(p_owner_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select ci.provider from public.channel_identities ci where ci.user_id = p_owner_user_id limit 1),
    'app'
  );
$$;

create or replace function public.recognition_ops_stats(p_since timestamptz, p_bucket text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with
  bounds as (
    select p_since as since, p_since - (now() - p_since) as previous_since
  ),
  classified as (
    -- Every task with its source type and channel, derived so history is covered too.
    select
      t.*,
      public.recognition_source_type(t.source_url) as source_type,
      public.recognition_channel(t.owner_user_id) as channel
    from public.recognition_tasks t
    where t.created_at >= (select previous_since from bounds)
  ),
  tasks as (select * from classified where created_at >= p_since),
  previous_tasks as (select * from classified where created_at < p_since),
  all_runs as (
    select r.* from public.recognition_runs r where r.finished_at >= (select previous_since from bounds)
  ),
  runs as (select * from all_runs where finished_at >= p_since),
  previous_runs as (select * from all_runs where finished_at < p_since),
  first_runs as (
    select distinct on (r.task_id) r.task_id, r.started_at
    from public.recognition_runs r
    join tasks t on t.id = r.task_id
    order by r.task_id, r.started_at
  ),
  waits as (
    select f.task_id, f.started_at, extract(epoch from (f.started_at - t.created_at)) * 1000 as wait_ms
    from first_runs f
    join tasks t on t.id = f.task_id
  ),
  buckets as (
    select generate_series(date_trunc(p_bucket, p_since), date_trunc(p_bucket, now()), ('1 ' || p_bucket)::interval) as bucket
  ),
  task_series as (
    select
      b.bucket,
      count(t.id) as requests,
      count(t.id) filter (where t.status in ('completed', 'committed')) as completed,
      count(t.id) filter (where t.status = 'failed') as failed
    from buckets b
    left join tasks t on date_trunc(p_bucket, t.created_at) = b.bucket
    group by b.bucket
  ),
  run_series as (
    select
      b.bucket,
      count(r.id) filter (where r.outcome = 'cache_hit') as cache_hits,
      percentile_cont(0.5) within group (order by r.total_ms) filter (where r.outcome = 'completed') as processing_p50_ms,
      percentile_cont(0.95) within group (order by r.total_ms) filter (where r.outcome = 'completed') as processing_p95_ms,
      coalesce(sum(r.cost_usd), 0) as cost_usd,
      coalesce(sum(r.prompt_tokens + r.completion_tokens), 0) as tokens,
      round(avg(r.fetch_ms) filter (where r.outcome = 'completed')) as fetch_ms,
      round(avg(r.analysis_ms) filter (where r.outcome = 'completed')) as analysis_ms,
      round(avg(r.match_ms) filter (where r.outcome = 'completed')) as match_ms,
      round(avg(r.thumbnails_ms) filter (where r.outcome = 'completed')) as thumbnails_ms
    from buckets b
    left join runs r on date_trunc(p_bucket, r.finished_at) = b.bucket
    group by b.bucket
  ),
  wait_series as (
    select b.bucket, percentile_cont(0.5) within group (order by w.wait_ms) as wait_p50_ms
    from buckets b
    left join waits w on date_trunc(p_bucket, w.started_at) = b.bucket
    group by b.bucket
  ),
  window_places as (
    select p as place
    from tasks t
    join public.recognition_results rr on rr.id = t.result_id
    cross join lateral jsonb_array_elements(coalesce(rr.places, '[]'::jsonb)) as p
    where t.status in ('completed', 'committed')
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
        'retried', count(*) filter (where retry_count > 0),
        'recovered', count(*) filter (where error_message = 'Recovered stale processing'),
        'active_users', count(distinct owner_user_id),
        'unique_sources', count(distinct source_url)
      )
      from tasks
    ),
    'previous', (
      select jsonb_build_object(
        'requests', (select count(*) from previous_tasks),
        'completed', (select count(*) from previous_tasks where status in ('completed', 'committed')),
        'failed', (select count(*) from previous_tasks where status = 'failed'),
        'active_users', (select count(distinct owner_user_id) from previous_tasks),
        'cache_hits', (select count(*) from previous_runs where outcome = 'cache_hit'),
        'completed_runs', (select count(*) from previous_runs where outcome = 'completed'),
        'zero_results', (select count(*) from previous_runs where outcome = 'completed' and places_extracted = 0),
        'cost_usd', (select coalesce(sum(cost_usd), 0) from previous_runs),
        'processing_p50_ms', (select percentile_cont(0.5) within group (order by total_ms) from previous_runs where outcome = 'completed')
      )
    ),
    'runs', (
      select jsonb_build_object(
        'total', count(*),
        'completed', count(*) filter (where outcome = 'completed'),
        'cache_hits', count(*) filter (where outcome = 'cache_hit'),
        'failed', count(*) filter (where outcome = 'failed'),
        'zero_results', count(*) filter (where outcome = 'completed' and places_extracted = 0),
        'processing_p50_ms', percentile_cont(0.5) within group (order by total_ms) filter (where outcome = 'completed'),
        'processing_p95_ms', percentile_cont(0.95) within group (order by total_ms) filter (where outcome = 'completed'),
        'cache_p50_ms', percentile_cont(0.5) within group (order by total_ms) filter (where outcome = 'cache_hit'),
        'model_p50_ms', percentile_cont(0.5) within group (order by analysis_ms) filter (where analysis_ms is not null),
        'model_p95_ms', percentile_cont(0.95) within group (order by analysis_ms) filter (where analysis_ms is not null),
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
        'bucket', ts.bucket,
        'requests', ts.requests,
        'completed', ts.completed,
        'failed', ts.failed,
        'cache_hits', rs.cache_hits,
        'processing_p50_ms', rs.processing_p50_ms,
        'processing_p95_ms', rs.processing_p95_ms,
        'wait_p50_ms', ws.wait_p50_ms,
        'cost_usd', rs.cost_usd,
        'tokens', rs.tokens,
        'fetch_ms', rs.fetch_ms,
        'analysis_ms', rs.analysis_ms,
        'match_ms', rs.match_ms,
        'thumbnails_ms', rs.thumbnails_ms
      ) order by ts.bucket), '[]'::jsonb)
      from task_series ts
      join run_series rs using (bucket)
      join wait_series ws using (bucket)
    ),
    'failures_by_step', (
      select coalesce(jsonb_agg(jsonb_build_object('step', failed_step, 'count', n) order by n desc), '[]'::jsonb)
      from (select failed_step, count(*) as n from runs where outcome = 'failed' group by failed_step) f
    ),
    'top_errors', (
      select coalesce(jsonb_agg(jsonb_build_object('message', message, 'step', step, 'count', n) order by n desc), '[]'::jsonb)
      from (
        select left(error_message, 160) as message, failed_step as step, count(*) as n
        from runs where outcome = 'failed'
        group by 1, 2
        order by n desc
        limit 6
      ) e
    ),
    'source_mix', (
      select coalesce(jsonb_agg(jsonb_build_object('type', source_type, 'count', n) order by n desc), '[]'::jsonb)
      from (select source_type, count(*) as n from tasks group by source_type) s
    ),
    'channel_mix', (
      select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'count', n, 'users', u) order by n desc), '[]'::jsonb)
      from (select channel, count(*) as n, count(distinct owner_user_id) as u from tasks group by channel) c
    ),
    'fetch_methods', (
      select coalesce(jsonb_agg(jsonb_build_object('method', fetch_method, 'count', n, 'failed', f) order by n desc), '[]'::jsonb)
      from (
        select fetch_method, count(*) as n, count(*) filter (where outcome = 'failed') as f
        from runs where fetch_method is not null
        group by fetch_method
      ) m
    ),
    'users', (
      select jsonb_build_object(
        'total', (select count(*) from public.users),
        'new', (select count(*) from public.users where created_at >= p_since),
        'new_instagram', (select count(*) from public.channel_identities where created_at >= p_since)
      )
    ),
    'library', (
      select jsonb_build_object(
        'saved_places', (select count(*) from public.saved_places where created_at >= p_since),
        'lists_created', (select count(*) from public.user_lists where created_at >= p_since),
        'list_additions', (select count(*) from public.list_places where created_at >= p_since),
        'catalog_places', (select count(*) from public.places),
        'catalog_new', (select count(*) from public.places where created_at >= p_since)
      )
    ),
    'top_places', (
      select coalesce(jsonb_agg(p order by p.count desc, p.name), '[]'::jsonb)
      from (
        select
          place->>'google_place_id' as google_place_id,
          max(place->>'name') as name,
          max(place->>'thumbnail_url') as thumbnail_url,
          max((place->>'rating')::numeric) as rating,
          count(*) as count
        from window_places
        where place ? 'google_place_id'
        group by place->>'google_place_id'
        order by count(*) desc, max(place->>'name')
        limit 8
      ) p
    )
  );
$$;


-- The latest recognitions with what the back office lists for each.
create function public.recognition_ops_list(p_limit integer)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by item->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', t.id,
      'source_url', t.source_url,
      'source_type', public.recognition_source_type(t.source_url),
      'channel', public.recognition_channel(t.owner_user_id),
      'status', t.status,
      'retry_count', t.retry_count,
      'error_message', t.error_message,
      'created_at', t.created_at,
      'started_at', t.started_at,
      'finished_at', t.finished_at,
      'thumbnail_url', rr.source_thumbnail_url,
      'caption', left(rr.caption, 200),
      'places_count', jsonb_array_length(coalesce(rr.places, '[]'::jsonb)),
      'place_names', (select jsonb_agg(p->>'name') from jsonb_array_elements(coalesce(rr.places, '[]'::jsonb)) p),
      'runs', (select count(*) from public.recognition_runs r where r.task_id = t.id),
      'last_outcome', (select r.outcome from public.recognition_runs r where r.task_id = t.id order by r.finished_at desc limit 1),
      'total_ms', (select r.total_ms from public.recognition_runs r where r.task_id = t.id order by r.finished_at desc limit 1),
      'cost_usd', (select sum(r.cost_usd) from public.recognition_runs r where r.task_id = t.id)
    ) as item
    from public.recognition_tasks t
    left join public.recognition_results rr on rr.id = t.result_id
    order by t.created_at desc
    limit p_limit
  ) x;
$$;

-- Everything about one recognition: source, timeline, every attempt, and the result.
create function public.recognition_ops_detail(p_task_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'source_url', t.source_url,
    'source_type', public.recognition_source_type(t.source_url),
    'channel', public.recognition_channel(t.owner_user_id),
    'owner_user_id', t.owner_user_id,
    'status', t.status,
    'retry_count', t.retry_count,
    'error_message', t.error_message,
    'idempotency_key', t.idempotency_key,
    'created_at', t.created_at,
    'started_at', t.started_at,
    'finished_at', t.finished_at,
    'source', case when rr.id is null then null else jsonb_build_object(
      'caption', rr.caption,
      'thumbnail_url', rr.source_thumbnail_url,
      'video_url', rr.video_url,
      'source_type', rr.source_type,
      'result_created_at', rr.created_at
    ) end,
    'places', coalesce(rr.places, '[]'::jsonb),
    'runs', (
      select coalesce(jsonb_agg(to_jsonb(r) - 'task_id' order by r.started_at), '[]'::jsonb)
      from public.recognition_runs r
      where r.task_id = t.id
    )
  )
  from public.recognition_tasks t
  left join public.recognition_results rr on rr.id = t.result_id
  where t.id = p_task_id;
$$;

revoke execute on function public.recognition_ops_list(integer) from public, anon, authenticated;
grant execute on function public.recognition_ops_list(integer) to service_role;
revoke execute on function public.recognition_ops_detail(uuid) from public, anon, authenticated;
grant execute on function public.recognition_ops_detail(uuid) to service_role;
revoke execute on function public.recognition_channel(uuid) from public, anon, authenticated;
grant execute on function public.recognition_channel(uuid) to service_role;
