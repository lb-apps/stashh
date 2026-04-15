-- Drop source_updated_at from places; updated_at is sufficient.

alter table public.places
  drop column if exists source_updated_at;
