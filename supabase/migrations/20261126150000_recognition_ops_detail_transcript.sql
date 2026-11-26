-- Add transcript to recognition_ops_detail response so the ops dashboard can show it.
create or replace function public.recognition_ops_detail(p_task_id uuid)
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
    'transcript', rr.transcript,
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
