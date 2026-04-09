-- Rename lists -> user_lists (API path: /api/v1/user-lists).
-- FKs from list_places.list_id follow the renamed referenced table automatically.

alter table public.lists rename to user_lists;

alter index if exists public.lists_owner_user_id_idx rename to user_lists_owner_user_id_idx;

alter trigger lists_set_updated_at on public.user_lists rename to user_lists_set_updated_at;

alter policy "Users manage own lists" on public.user_lists rename to "Users manage own user_lists";
