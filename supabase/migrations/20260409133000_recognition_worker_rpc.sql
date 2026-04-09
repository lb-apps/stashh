-- Recognition queue worker RPC helpers.

create or replace function public.claim_recognitions(
  p_worker_identifier text,
  p_claim_limit integer default 1
)
returns setof public.recognitions
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select recognitions.id
    from public.recognitions
    where recognitions.status = 'queued'
      and recognitions.run_at <= now()
    order by recognitions.run_at asc, recognitions.created_at asc
    for update skip locked
    limit greatest(p_claim_limit, 1)
  )
  update public.recognitions
  set status = 'processing',
      started_at = now(),
      claimed_at = now(),
      last_transition_at = now(),
      error_message = null
  where recognitions.id in (select next_jobs.id from next_jobs)
  returning recognitions.*;
end;
$$;

create or replace function public.recover_stale_recognitions(
  p_stale_after_milliseconds integer,
  p_claim_limit integer default 100
)
returns setof public.recognitions
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with stale_jobs as (
    select recognitions.id
    from public.recognitions
    where recognitions.status = 'processing'
      and recognitions.claimed_at is not null
      and recognitions.claimed_at <= (now() - make_interval(secs => greatest(p_stale_after_milliseconds, 1000) / 1000.0))
    order by recognitions.claimed_at asc
    for update skip locked
    limit greatest(p_claim_limit, 1)
  )
  update public.recognitions
  set status = 'queued',
      run_at = now(),
      claimed_at = null,
      error_message = coalesce(recognitions.error_message, 'Recovered stale claim'),
      last_transition_at = now()
  where recognitions.id in (select stale_jobs.id from stale_jobs)
  returning recognitions.*;
end;
$$;

grant execute on function public.claim_recognitions(text, integer) to authenticated, service_role;
grant execute on function public.recover_stale_recognitions(integer, integer) to authenticated, service_role;
