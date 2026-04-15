-- Rename instagram -> instagram_username on places table.

alter table public.places
  rename column instagram to instagram_username;
