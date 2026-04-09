-- Recognition refactor:
-- - public.recognitions -> public.recognition_tasks
-- - add public.recognition_results with reusable items JSON payload
-- - remove deprecated retry/claim columns
-- - update worker RPCs to started_at-based claim recovery
-- - create storage bucket for place thumbnails

do $$
begin
  if not exists (
    select 1
    from pg_tables
    where schemaname = 'public' and tablename = 'recognition_results'
  ) then
    create table public.recognition_results (
      id uuid primary key default gen_random_uuid(),
      normalized_source_url text not null unique,
      items jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create trigger recognition_results_set_updated_at
    before update on public.recognition_results
    for each row
    execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'recognitions'
  ) and not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'recognition_tasks'
  ) then
    alter table public.recognitions rename to recognition_tasks;
  end if;
end
$$;

alter table if exists public.recognition_tasks
  add column if not exists normalized_source_url text;

update public.recognition_tasks
set normalized_source_url = coalesce(normalized_source_url, source_url)
where normalized_source_url is null;

alter table if exists public.recognition_tasks
  alter column normalized_source_url set not null;

alter table if exists public.recognition_tasks
  add column if not exists result_id uuid references public.recognition_results (id) on delete set null;

drop index if exists recognitions_owner_status_created_idx;
drop index if exists recognitions_worker_claim_idx;
drop index if exists recognitions_processing_stale_idx;
drop index if exists recognitions_retry_idx;
drop index if exists recognitions_expires_at_idx;

alter table if exists public.recognition_tasks
  drop column if exists results,
  drop column if exists run_at,
  drop column if exists claimed_at,
  drop column if exists last_transition_at,
  drop column if exists max_retries,
  drop column if exists status_metadata,
  drop column if exists expires_at;

create index if not exists recognition_tasks_owner_status_created_idx
  on public.recognition_tasks (owner_user_id, status, created_at desc);

create index if not exists recognition_tasks_worker_claim_idx
  on public.recognition_tasks (status, created_at asc);

create index if not exists recognition_tasks_processing_started_idx
  on public.recognition_tasks (status, started_at asc)
  where status = 'processing';

create or replace function public.claim_recognitions(
  p_worker_identifier text,
  p_claim_limit integer default 1
)
returns setof public.recognition_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with next_jobs as (
    select recognition_tasks.id
    from public.recognition_tasks
    where recognition_tasks.status = 'queued'
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
$$;

create or replace function public.recover_stale_recognitions(
  p_stale_after_milliseconds integer,
  p_claim_limit integer default 100
)
returns setof public.recognition_tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with stale_jobs as (
    select recognition_tasks.id
    from public.recognition_tasks
    where recognition_tasks.status = 'processing'
      and recognition_tasks.started_at is not null
      and recognition_tasks.started_at <= (now() - make_interval(secs => greatest(p_stale_after_milliseconds, 1000) / 1000.0))
    order by recognition_tasks.started_at asc
    for update skip locked
    limit greatest(p_claim_limit, 1)
  )
  update public.recognition_tasks
  set status = 'queued',
      started_at = null,
      error_message = coalesce(recognition_tasks.error_message, 'Recovered stale processing')
  where recognition_tasks.id in (select stale_jobs.id from stale_jobs)
  returning recognition_tasks.*;
end;
$$;

grant execute on function public.claim_recognitions(text, integer) to authenticated, service_role;
grant execute on function public.recover_stale_recognitions(integer, integer) to authenticated, service_role;

alter table if exists public.recognition_tasks enable row level security;
alter table if exists public.recognition_results enable row level security;

drop policy if exists "Users manage own recognitions" on public.recognition_tasks;
create policy "Users manage own recognition tasks"
on public.recognition_tasks
for all
to authenticated
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

drop policy if exists "Users read own recognition results through tasks" on public.recognition_results;
create policy "Users read own recognition results through tasks"
on public.recognition_results
for select
to authenticated
using (
  exists (
    select 1
    from public.recognition_tasks t
    where t.result_id = recognition_results.id
      and t.owner_user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('place-thumbnails', 'place-thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "Public read place-thumbnails" on storage.objects;
create policy "Public read place-thumbnails"
on storage.objects
for select
to public
using (bucket_id = 'place-thumbnails');

