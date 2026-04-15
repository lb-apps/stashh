-- Rename user_places -> saved_places.
-- FKs from list_places and user_visits follow the renamed referenced table automatically.

alter table public.user_places rename to saved_places;

-- FK column renames in dependent tables
alter table public.list_places rename column user_place_id to saved_place_id;
alter table public.user_visits rename column user_place_id to saved_place_id;

-- Index renames
alter index if exists public.user_places_owner_user_id_created_at_idx
  rename to saved_places_owner_user_id_created_at_idx;
alter index if exists public.user_places_recognition_result_id_idx
  rename to saved_places_recognition_result_id_idx;

-- Trigger rename
alter trigger user_places_set_updated_at on public.saved_places
  rename to saved_places_set_updated_at;

-- RLS policy rename
alter policy "Users manage own user_places" on public.saved_places
  rename to "Users manage own saved_places";
