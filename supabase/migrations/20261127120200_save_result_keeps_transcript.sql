-- save_recognition_result keeps the stored transcript when the backend passes { "keep": true }:
-- Whisper could not be reached (after a retry), which is not the reel having no speech. Without
-- this, a re-analysis during a Whisper outage erased a good transcript.
--
--   p_transcript  { model, language, full_text, segments }, null (no speech: the stored one goes),
--                 or { keep: true } (the stored one stays).
create or replace function public.save_recognition_result(
  p_source_url text,
  p_result jsonb,
  p_transcript jsonb,
  p_places jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result_id uuid;
  v_keeps_evidence boolean := coalesce(p_result ->> 'source_type', '') <> 'story';
begin
  insert into public.recognition_results as r (
    source_url, places, names_elsewhere, video_url, caption, source_type,
    source_thumbnail_url, author_username, addresses_the_ai
  )
  values (
    p_source_url,
    coalesce(p_result -> 'places', '[]'::jsonb),
    coalesce((p_result ->> 'names_elsewhere')::boolean, false),
    p_result ->> 'video_url',
    p_result ->> 'caption',
    p_result ->> 'source_type',
    p_result ->> 'source_thumbnail_url',
    p_result ->> 'author_username',
    coalesce((p_result ->> 'addresses_the_ai')::boolean, false)
  )
  on conflict (source_url) do update set
    places = excluded.places,
    names_elsewhere = excluded.names_elsewhere,
    video_url = excluded.video_url,
    caption = excluded.caption,
    source_type = excluded.source_type,
    source_thumbnail_url = coalesce(excluded.source_thumbnail_url, r.source_thumbnail_url),
    author_username = coalesce(excluded.author_username, r.author_username),
    addresses_the_ai = excluded.addresses_the_ai
  returning r.id into v_result_id;

  -- { keep: true }: Whisper could not be reached, and the reel's speech has not changed since the
  -- stored transcript was written, so it stays (with its spans, which attribution redoes).
  if not coalesce((p_transcript ->> 'keep')::boolean, false) then
    delete from public.recognition_transcripts where result_id = v_result_id;
    if v_keeps_evidence and jsonb_typeof(p_transcript) = 'object'
       and nullif(btrim(p_transcript ->> 'full_text'), '') is not null then
      insert into public.recognition_transcripts (result_id, model, language, full_text, segments)
      values (
        v_result_id,
        p_transcript ->> 'model',
        p_transcript ->> 'language',
        p_transcript ->> 'full_text',
        coalesce(p_transcript -> 'segments', '[]'::jsonb)
      );
    end if;
  end if;

  delete from public.recognition_result_places where result_id = v_result_id;
  -- Two names in one post can resolve to the same listing; the first one stands.
  insert into public.recognition_result_places (result_id, place_id, position, confidence)
  select v_result_id, (e.p ->> 'place_id')::uuid, (e.ord - 1)::smallint, (e.p ->> 'confidence')::real
  from jsonb_array_elements(coalesce(p_places, '[]'::jsonb)) with ordinality as e(p, ord)
  order by e.ord
  on conflict do nothing;

  if v_keeps_evidence then
    insert into public.place_mentions (result_id, place_id, source, start_s, slide_index, on_screen_text)
    select v_result_id, (e.p ->> 'place_id')::uuid, 'on_screen',
           (o.s ->> 'at_s')::numeric, (o.s ->> 'slide_index')::smallint, o.s ->> 'text'
    from jsonb_array_elements(coalesce(p_places, '[]'::jsonb)) as e(p)
    cross join lateral jsonb_array_elements(coalesce(e.p -> 'on_screen', '[]'::jsonb)) as o(s)
    where nullif(btrim(o.s ->> 'text'), '') is not null;

    if exists (select 1 from public.recognition_result_places where result_id = v_result_id) then
      insert into public.evidence_jobs (kind, subject_id)
      values ('attribute', v_result_id)
      on conflict (kind, subject_id) where status = 'queued' do nothing;
    end if;
  end if;

  return v_result_id;
end;
$$;
