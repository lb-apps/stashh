-- saved_places: drop recognition_result_id — unused provenance link.

drop index if exists public.saved_places_recognition_result_id_idx;

alter table public.saved_places
  drop column if exists recognition_result_id;
