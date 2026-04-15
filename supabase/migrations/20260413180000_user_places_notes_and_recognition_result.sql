-- user_places: rename personal_note -> notes, replace saved_from_source_url with recognition_result_id (FK to recognition_results).

-- 1. Rename personal_note -> notes
alter table public.user_places
  rename column personal_note to notes;

-- 2. Drop saved_from_source_url
alter table public.user_places
  drop column if exists saved_from_source_url;

-- 3. Add recognition_result_id as nullable FK to recognition_results
alter table public.user_places
  add column if not exists recognition_result_id uuid
    references public.recognition_results (id) on delete set null;

create index if not exists user_places_recognition_result_id_idx
  on public.user_places (recognition_result_id);
