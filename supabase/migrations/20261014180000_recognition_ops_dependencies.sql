-- Which platform a recognition's source lives on. Shared helper, like
-- recognition_source_type(): every ops query asks this function, never re-derives it.
create function public.recognition_source_platform(p_source_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_source_url ~* 'tiktok\.com' then 'tiktok' else 'instagram' end;
$$;

-- How each outside service behaved for fresh runs since p_since. A run that failed at a
-- step passed every step before it, so a step's attempts are the runs that reached it;
-- typical_ms is the median time the step took. Cache hits skip all of these steps.
create function public.recognition_ops_dependencies(p_since timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with fresh as (
    select
      r.fetch_ms, r.analysis_ms, r.match_ms, r.thumbnails_ms, r.save_ms,
      public.recognition_source_platform(t.source_url) as platform,
      case r.failed_step
        when 'content fetched' then 0
        when 'media analyzed' then 1
        when 'places found' then 2
        when 'thumbnails saved' then 3
        when 'result saved' then 4
        else 5
      end as stopped_at
    from public.recognition_runs r
    join public.recognition_tasks t on t.id = r.task_id
    where r.finished_at >= p_since and r.outcome <> 'cache_hit'
  ),
  deps as (
    select 1 as ord, 'instagram_fetch' as key,
      count(*) filter (where platform = 'instagram') as attempts,
      count(*) filter (where platform = 'instagram' and stopped_at = 0) as failures,
      percentile_cont(0.5) within group (order by fetch_ms) filter (where platform = 'instagram') as typical_ms
    from fresh
    union all
    select 2, 'tiktok_fetch',
      count(*) filter (where platform = 'tiktok'),
      count(*) filter (where platform = 'tiktok' and stopped_at = 0),
      percentile_cont(0.5) within group (order by fetch_ms) filter (where platform = 'tiktok')
    from fresh
    union all
    select 3, 'model',
      count(*) filter (where stopped_at >= 1),
      count(*) filter (where stopped_at = 1),
      percentile_cont(0.5) within group (order by analysis_ms) filter (where stopped_at >= 1)
    from fresh
    union all
    select 4, 'places',
      count(*) filter (where stopped_at >= 2),
      count(*) filter (where stopped_at = 2),
      percentile_cont(0.5) within group (order by match_ms) filter (where stopped_at >= 2)
    from fresh
    union all
    select 5, 'storage',
      count(*) filter (where stopped_at >= 3),
      count(*) filter (where stopped_at = 3),
      percentile_cont(0.5) within group (order by thumbnails_ms) filter (where stopped_at >= 3)
    from fresh
    union all
    select 6, 'database',
      count(*) filter (where stopped_at >= 4),
      count(*) filter (where stopped_at = 4),
      percentile_cont(0.5) within group (order by save_ms) filter (where stopped_at >= 4)
    from fresh
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('key', key, 'attempts', attempts, 'failures', failures, 'typical_ms', round(typical_ms))
      order by ord
    ),
    '[]'::jsonb
  )
  from deps;
$$;

revoke execute on function public.recognition_source_platform(text) from public, anon, authenticated;
grant execute on function public.recognition_source_platform(text) to service_role;
revoke execute on function public.recognition_ops_dependencies(timestamptz) from public, anon, authenticated;
grant execute on function public.recognition_ops_dependencies(timestamptz) to service_role;
