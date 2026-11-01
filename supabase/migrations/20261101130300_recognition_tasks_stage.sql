-- What a processing recognition is doing right now, so a client can show live progress:
-- fetching the post, analyzing its media, matching venues to places, saving the result.
-- Written by the worker as it goes; null while queued.

alter table public.recognition_tasks
  add column stage text
    check (stage is null or stage in ('fetching', 'analyzing', 'matching', 'saving'));

comment on column public.recognition_tasks.stage is
  'Step the worker is on: fetching → analyzing → matching → saving. Null while queued; the last step stays after the task finishes.';
