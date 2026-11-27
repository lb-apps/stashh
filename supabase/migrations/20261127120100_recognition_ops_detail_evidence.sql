-- The ops run detail reads the evidence tables (20261127120000_place_evidence.sql):
--   transcript   from recognition_transcripts, with the model that wrote it;
--   mentions     per place (keyed by google_place_id, as `places` is), the parts of the reel tied to
--                it, each with its words cut from the reel's own transcript, caption or screen text;
--   attribution  the result's latest attribute job: state, error, cost.
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
    'transcript', (
      select jsonb_build_object('full_text', tr.full_text, 'segments', tr.segments, 'model', tr.model)
      from public.recognition_transcripts tr
      where tr.result_id = rr.id
    ),
    'mentions', (
      select coalesce(jsonb_object_agg(g.google_place_id, g.items), '{}'::jsonb)
      from (
        select p.google_place_id,
               jsonb_agg(
                 jsonb_build_object(
                   'source', m.source,
                   'start_s', m.start_s,
                   'end_s', m.end_s,
                   'slide_index', m.slide_index,
                   'text', case m.source
                     when 'on_screen' then m.on_screen_text
                     when 'caption' then substr(rr.caption, m.caption_start + 1, m.caption_end - m.caption_start)
                     else (
                       select string_agg(s.seg ->> 'text', ' ' order by s.ord)
                       from public.recognition_transcripts tr2
                       cross join lateral jsonb_array_elements(tr2.segments) with ordinality as s(seg, ord)
                       where tr2.id = m.transcript_id
                         and (s.seg ->> 'start_s')::numeric >= m.start_s
                         and (s.seg ->> 'end_s')::numeric <= m.end_s
                     )
                   end
                 )
                 order by case m.source when 'speech' then 0 when 'on_screen' then 1 else 2 end,
                          m.start_s nulls last, m.slide_index nulls last, m.caption_start nulls last
               ) as items
        from public.place_mentions m
        join public.places p on p.id = m.place_id
        where m.result_id = rr.id
        group by p.google_place_id
      ) g
    ),
    'attribution', (
      select jsonb_build_object(
        'status', j.status,
        'attempts', j.attempts,
        'last_error', j.last_error,
        'model', j.model,
        'cost_usd', j.cost_usd,
        'finished_at', j.finished_at
      )
      from public.evidence_jobs j
      where j.kind = 'attribute' and j.subject_id = rr.id
      order by j.created_at desc
      limit 1
    ),
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
