-- Rename user_rating_count -> rating_count on places table.

alter table public.places
  rename column user_rating_count to rating_count;
