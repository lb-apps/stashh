-- Worker + dashboard subscribe to postgres_changes on recognition_tasks.
-- Without this row, the worker falls back to RECOGNITIONS_POLL_MAX_MS sleeps.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recognition_tasks'
  ) then
    alter publication supabase_realtime add table public.recognition_tasks;
  end if;
end $$;
