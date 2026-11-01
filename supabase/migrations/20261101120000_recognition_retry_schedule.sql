-- A failed attempt waits for its next one in the queue, not in the worker: the backoff used
-- to be a sleep inside one of the two worker slots, so a long wait held up everyone else's
-- recognitions. Long waits are needed now: the media downloader throttles for 20–30 s, and
-- retries one, two and four seconds apart all landed inside that window.
alter table public.recognition_tasks
  add column if not exists available_at timestamptz not null default now();

comment on column public.recognition_tasks.available_at is
  'Earliest time a queued task may be claimed: now() when enqueued, later when a failed attempt is retried with backoff.';

create or replace function public.claim_recognitions(p_worker_identifier text, p_claim_limit integer default 1)
returns setof public.recognition_tasks
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with next_jobs as (
    select recognition_tasks.id
    from public.recognition_tasks
    where recognition_tasks.status = 'queued'
      and recognition_tasks.available_at <= now()
    order by recognition_tasks.created_at asc
    for update skip locked
    limit greatest(p_claim_limit, 1)
  )
  update public.recognition_tasks
  set status = 'processing',
      started_at = now(),
      error_message = null
  where recognition_tasks.id in (select next_jobs.id from next_jobs)
  returning recognition_tasks.*;
end;
$function$;

-- A post whose media could not be fetched is read from its caption alone.
alter table public.recognition_runs drop constraint if exists recognition_runs_fetch_method_check;
alter table public.recognition_runs
  add constraint recognition_runs_fetch_method_check
  check (fetch_method in ('scrape', 'downloader', 'tiktok', 'supplied', 'caption'));
