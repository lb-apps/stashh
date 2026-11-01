-- Where a saved place came from: the recognition that found it, so the web app can show
-- "Saved from @author · Reel" and open the post.
--
-- The task, not the result, is the link: a result is shared by everyone who sent the
-- same post, a task belongs to one person. Deleting a task keeps the saved place.

alter table public.saved_places
  add column source_recognition_task_id uuid
    references public.recognition_tasks (id) on delete set null;

create index saved_places_source_recognition_task_id_idx
  on public.saved_places (source_recognition_task_id)
  where source_recognition_task_id is not null;

comment on column public.saved_places.source_recognition_task_id is
  'Recognition that found this place for this person; null for places saved from search or found before 2026-11.';

-- The post's author, when the source names one (Instagram page, TikTok link). Null when
-- it cannot be read, e.g. a post shared in a DM, which arrives without its owner.
alter table public.recognition_results
  add column author_username text
    check (author_username is null or author_username ~ '^[A-Za-z0-9._]{1,30}$');

comment on column public.recognition_results.author_username is
  'Username of the post''s author on its platform, without @; null when the source does not name one.';
