-- Recognition tasks are written by the backend only, and nobody reads another person's.
--
-- Before this migration:
--   * the policy "Allow anon realtime select on recognition_tasks" (created outside the
--     migrations) let anyone holding the public key read every task: owner ids, shared
--     links, captions. It existed so the worker could hear new tasks over Realtime
--     postgres_changes with the publishable key;
--   * "Users manage own recognition tasks" let a signed-in person insert and update their
--     own tasks straight through PostgREST, past the daily allowance and, from the billing
--     migration on, past their credits.
--
-- After it:
--   * the worker is woken by a Broadcast from the database (`realtime.send`) on the public
--     topic `recognition-worker`; the message carries no data, only "a task is queued", and
--     the table leaves the Realtime publication;
--   * the anon policy is gone; a signed-in person can only read their own tasks;
--   * insert, update and delete belong to the service role (the backend and its worker).

-- ── Wake the worker without exposing a row ──────────────────────────────────────

create function public.wake_recognition_worker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- An empty, public broadcast: subscribers learn that something is queued, nothing more.
  -- A wake-up is a courtesy (the worker also polls): it must never fail the write.
  begin
    perform realtime.send('{}'::jsonb, 'queued', 'recognition-worker', false);
  exception when others then
    raise warning 'recognition worker wake-up not sent: %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.wake_recognition_worker() from public, anon, authenticated;

comment on function public.wake_recognition_worker() is
  'Trigger: broadcasts an empty "queued" message on the public Realtime topic recognition-worker.';

create trigger recognition_tasks_wake_worker
  after insert or update of status, available_at on public.recognition_tasks
  for each row
  when (new.status = 'queued')
  execute function public.wake_recognition_worker();

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recognition_tasks'
  ) then
    alter publication supabase_realtime drop table public.recognition_tasks;
  end if;
end;
$$;

-- ── Policies and grants ─────────────────────────────────────────────────────────

drop policy if exists "Allow anon realtime select on recognition_tasks" on public.recognition_tasks;
drop policy if exists "Users manage own recognition tasks" on public.recognition_tasks;

create policy "Users read own recognition tasks"
  on public.recognition_tasks
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

revoke all on table public.recognition_tasks from anon, authenticated;
grant select on table public.recognition_tasks to authenticated;
