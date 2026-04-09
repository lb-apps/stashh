-- Wake workers immediately when new queued recognition tasks arrive.

create or replace function public.notify_recognition_queue_wakeup()
returns trigger
language plpgsql
as $$
begin
  perform pg_notify('recognition_queue_wakeup', new.id::text);
  return new;
end;
$$;

drop trigger if exists recognition_queue_wakeup_on_insert on public.recognition_tasks;
create trigger recognition_queue_wakeup_on_insert
after insert on public.recognition_tasks
for each row
when (new.status = 'queued')
execute function public.notify_recognition_queue_wakeup();

drop trigger if exists recognition_queue_wakeup_on_requeue on public.recognition_tasks;
create trigger recognition_queue_wakeup_on_requeue
after update of status on public.recognition_tasks
for each row
when (new.status = 'queued' and old.status is distinct from new.status)
execute function public.notify_recognition_queue_wakeup();
