-- What each reel says about each place it features.
--
--   recognition_transcripts    the reel's full spoken transcript (Whisper), one per result. It belongs
--                              to the reel and is never copied onto a place. Replaced, not edited, when
--                              the reel is analysed again, so a time span always points at the
--                              transcript it was read from.
--   recognition_result_places  which places a result features: the relation that used to exist only
--                              inside `recognition_results.places`.
--   place_mentions             which part of a reel is about which place: a span of the transcript, a
--                              range of the caption, or text read off the screen. A reference, never a
--                              copy: the words are always the reel's own.
--   evidence_jobs              background work after a recognition: `attribute` ties a result's
--                              transcript and caption to its places; `digest` (next) rebuilds a
--                              place's tips from all of its evidence.
--
-- `recognition_results.places` stays: it is the snapshot the API, the DM reply, the cache and the
-- charge trigger read. Stories keep no transcript and no mentions: Meta allows reading a story, not
-- storing it. Everything here is service role only.

-- ── Results ──────────────────────────────────────────────────────────────────

alter table public.recognition_results
  add column if not exists addresses_the_ai boolean not null default false;

comment on column public.recognition_results.addresses_the_ai is
  'The post spoke to an AI or asked for the output to be changed. Its tips are dropped; its evidence is left out of place digests.';

-- ── Transcripts ──────────────────────────────────────────────────────────────

create table public.recognition_transcripts (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null unique references public.recognition_results (id) on delete cascade,
  -- The speech-to-text model; null for transcripts kept before models were recorded.
  model text,
  language text,
  full_text text not null,
  -- [{ start_s, end_s, text }] in spoken order; a segment's position is its index.
  segments jsonb not null default '[]'::jsonb check (jsonb_typeof(segments) = 'array'),
  created_at timestamptz not null default now()
);

comment on table public.recognition_transcripts is
  'A reel''s full spoken transcript, one per result, replaced whole when the reel is analysed again. Service role only.';

insert into public.recognition_transcripts (result_id, model, full_text, segments, created_at)
select r.id, null, r.transcript ->> 'full_text', coalesce(r.transcript -> 'segments', '[]'::jsonb), r.updated_at
from public.recognition_results as r
where r.transcript is not null
  and nullif(btrim(r.transcript ->> 'full_text'), '') is not null
  and jsonb_typeof(coalesce(r.transcript -> 'segments', '[]'::jsonb)) = 'array'
  and coalesce(r.source_type, '') <> 'story';

-- ── Places a result features ─────────────────────────────────────────────────

create table public.recognition_result_places (
  result_id uuid not null references public.recognition_results (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  -- Order the post features them in.
  position smallint not null,
  confidence real,
  primary key (result_id, place_id)
);

create index recognition_result_places_place_idx on public.recognition_result_places (place_id);

comment on table public.recognition_result_places is
  'Which places a recognition result features. Service role only.';

-- ── Mentions ─────────────────────────────────────────────────────────────────

create table public.place_mentions (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null,
  place_id uuid not null,
  source text not null check (source in ('speech', 'caption', 'on_screen')),
  -- speech: the transcript the span was read from.
  transcript_id uuid references public.recognition_transcripts (id) on delete cascade,
  -- speech: the span, from the first segment's start to the last one's end.
  -- on_screen: start_s is when a video shows the text; slide_index which slide of a carousel does.
  start_s numeric,
  end_s numeric,
  -- caption: a range of the caption in Unicode code points, end exclusive.
  caption_start integer,
  caption_end integer,
  slide_index smallint,
  -- on_screen: the text as the vision model read it, cleaned and bounded.
  on_screen_text text,
  created_at timestamptz not null default now(),
  foreign key (result_id, place_id)
    references public.recognition_result_places (result_id, place_id) on delete cascade,
  check (
    case source
      when 'speech' then transcript_id is not null and start_s is not null and end_s is not null
        and start_s >= 0 and start_s <= end_s
      when 'caption' then caption_start is not null and caption_end is not null
        and caption_start >= 0 and caption_start < caption_end
      when 'on_screen' then on_screen_text is not null and length(on_screen_text) between 1 and 300
    end
  )
);

create index place_mentions_place_idx on public.place_mentions (place_id);
create index place_mentions_result_idx on public.place_mentions (result_id);
create index place_mentions_transcript_idx on public.place_mentions (transcript_id) where transcript_id is not null;

comment on table public.place_mentions is
  'Which part of a reel is about which place: a transcript span, a caption range or on-screen text. References the reel''s own words, never a copy. Service role only.';

-- ── Background jobs ──────────────────────────────────────────────────────────

create table public.evidence_jobs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('attribute', 'digest')),
  -- attribute: a recognition_results id. digest: a places id.
  subject_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  available_at timestamptz not null default now(),
  -- A running job whose worker died returns to the queue once its lease runs out.
  locked_until timestamptz,
  attempts integer not null default 0,
  last_error text,
  -- What the job's model calls cost, summed over its attempts.
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  cost_usd numeric(12, 8),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- One waiting job per subject: enqueueing again while one waits does nothing.
create unique index evidence_jobs_one_queued_idx on public.evidence_jobs (kind, subject_id) where status = 'queued';
create index evidence_jobs_due_idx on public.evidence_jobs (available_at) where status = 'queued';
create index evidence_jobs_lease_idx on public.evidence_jobs (locked_until) where status = 'running';
create index evidence_jobs_subject_idx on public.evidence_jobs (subject_id, created_at desc);

comment on table public.evidence_jobs is
  'Background work after a recognition: attribute a result''s transcript and caption to its places, digest a place''s evidence into tips. Service role only.';

-- ── Lockdown ─────────────────────────────────────────────────────────────────

alter table public.recognition_transcripts enable row level security;
alter table public.recognition_result_places enable row level security;
alter table public.place_mentions enable row level security;
alter table public.evidence_jobs enable row level security;

revoke all on table
  public.recognition_transcripts,
  public.recognition_result_places,
  public.place_mentions,
  public.evidence_jobs
from anon, authenticated;

-- ── Saving a result ──────────────────────────────────────────────────────────

-- Writes what one analysis found in one transaction: the result (upserted on its source URL), its
-- transcript, the places it features and the text read off the screen for each. The result's earlier
-- transcript and places are deleted first, which deletes every mention hanging off them, so nothing
-- from an earlier analysis survives a new one. A result with places then waits for attribution.
--
--   p_result      { places, names_elsewhere, video_url, caption, source_type, source_thumbnail_url,
--                   author_username, addresses_the_ai }; a null thumbnail or author keeps the stored one.
--   p_transcript  { model, language, full_text, segments } or null.
--   p_places      [{ place_id, confidence, on_screen: [{ text, at_s, slide_index }] }] in post order.
create function public.save_recognition_result(
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

-- ── Attribution ──────────────────────────────────────────────────────────────

-- Replaces a result's speech and caption mentions with what one attribution run found. The run read
-- the result at some point; if the reel was analysed again since (another transcript, another
-- caption), nothing is written and false comes back: the job the new analysis queued attributes it.
-- Mentions of a place the result no longer features are skipped.
--
--   p_mentions  [{ place_id, source: 'speech', start_s, end_s }
--                | { place_id, source: 'caption', caption_start, caption_end }]
create function public.replace_result_mentions(
  p_result_id uuid,
  p_transcript_id uuid,
  p_caption_md5 text,
  p_mentions jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from public.recognition_results as r
  where r.id = p_result_id and md5(coalesce(r.caption, '')) = p_caption_md5
  for update;
  if not found then
    return false;
  end if;

  if p_transcript_id is distinct from (
    select t.id from public.recognition_transcripts as t where t.result_id = p_result_id
  ) then
    return false;
  end if;

  delete from public.place_mentions
  where result_id = p_result_id and source in ('speech', 'caption');

  insert into public.place_mentions (result_id, place_id, source, transcript_id, start_s, end_s, caption_start, caption_end)
  select p_result_id,
         (e.m ->> 'place_id')::uuid,
         e.m ->> 'source',
         case when e.m ->> 'source' = 'speech' then p_transcript_id end,
         (e.m ->> 'start_s')::numeric,
         (e.m ->> 'end_s')::numeric,
         (e.m ->> 'caption_start')::integer,
         (e.m ->> 'caption_end')::integer
  from jsonb_array_elements(coalesce(p_mentions, '[]'::jsonb)) as e(m)
  where e.m ->> 'source' in ('speech', 'caption')
    and exists (
      select 1 from public.recognition_result_places as rp
      where rp.result_id = p_result_id and rp.place_id = (e.m ->> 'place_id')::uuid
    );

  return true;
end;
$$;

-- ── Job queue ────────────────────────────────────────────────────────────────

-- Claims due jobs for one worker. SKIP LOCKED lets workers claim concurrently; the lease returns a
-- job whose worker died to the queue. Jobs are idempotent, so a job claimed twice does no harm.
create function public.claim_evidence_jobs(p_limit integer, p_lease_seconds integer)
returns setof public.evidence_jobs
language sql
security invoker
set search_path = ''
as $$
  update public.evidence_jobs as j
  set status = 'running',
      attempts = j.attempts + 1,
      locked_until = now() + make_interval(secs => p_lease_seconds)
  where j.id in (
    select c.id
    from public.evidence_jobs as c
    where (c.status = 'queued' and c.available_at <= now())
       or (c.status = 'running' and c.locked_until < now())
    order by c.available_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  returning j.*;
$$;

-- Ends one attempt: done, failed for good, or back in the queue after p_retry_seconds. A job that
-- would go back while another one for the same subject already waits is marked failed instead: the
-- waiting one does the work. Model usage adds up over attempts.
create function public.finish_evidence_job(
  p_id bigint,
  p_outcome text,
  p_error text,
  p_retry_seconds integer,
  p_model text,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_cost_usd numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_outcome text := p_outcome;
  v_job public.evidence_jobs%rowtype;
begin
  if v_outcome not in ('done', 'retry', 'failed') then
    raise exception 'unknown outcome %', v_outcome;
  end if;

  select * into v_job from public.evidence_jobs where id = p_id for update;
  if not found then
    return;
  end if;

  if v_outcome = 'retry' and exists (
    select 1 from public.evidence_jobs as q
    where q.kind = v_job.kind and q.subject_id = v_job.subject_id and q.status = 'queued' and q.id <> p_id
  ) then
    v_outcome := 'failed';
  end if;

  update public.evidence_jobs
  set status = case v_outcome when 'retry' then 'queued' else v_outcome end,
      available_at = case when v_outcome = 'retry' then now() + make_interval(secs => greatest(p_retry_seconds, 1)) else available_at end,
      locked_until = null,
      last_error = case when v_outcome = 'done' then null else left(p_error, 2000) end,
      model = coalesce(p_model, model),
      prompt_tokens = case when p_prompt_tokens is null then prompt_tokens else coalesce(prompt_tokens, 0) + p_prompt_tokens end,
      completion_tokens = case when p_completion_tokens is null then completion_tokens else coalesce(completion_tokens, 0) + p_completion_tokens end,
      cost_usd = case when p_cost_usd is null then cost_usd else coalesce(cost_usd, 0) + p_cost_usd end,
      finished_at = case when v_outcome = 'retry' then null else now() end
  where id = p_id;
end;
$$;

-- Queues attribution for results saved before this migration (the backfill script). Results that
-- feature no place, stories, and results that already have a waiting job are skipped.
create function public.enqueue_result_attribution(p_result_ids uuid[])
returns integer
language sql
security invoker
set search_path = ''
as $$
  with queued as (
    insert into public.evidence_jobs (kind, subject_id)
    select 'attribute', r.id
    from public.recognition_results as r
    where r.id = any (p_result_ids)
      and coalesce(r.source_type, '') <> 'story'
      and exists (select 1 from public.recognition_result_places as rp where rp.result_id = r.id)
    on conflict (kind, subject_id) where status = 'queued' do nothing
    returning 1
  )
  select count(*)::integer from queued;
$$;

revoke execute on function
  public.save_recognition_result(text, jsonb, jsonb, jsonb),
  public.replace_result_mentions(uuid, uuid, text, jsonb),
  public.claim_evidence_jobs(integer, integer),
  public.finish_evidence_job(bigint, text, text, integer, text, integer, integer, numeric),
  public.enqueue_result_attribution(uuid[])
from public, anon, authenticated;

grant execute on function
  public.save_recognition_result(text, jsonb, jsonb, jsonb),
  public.replace_result_mentions(uuid, uuid, text, jsonb),
  public.claim_evidence_jobs(integer, integer),
  public.finish_evidence_job(bigint, text, text, integer, text, integer, integer, numeric),
  public.enqueue_result_attribution(uuid[])
to service_role;
