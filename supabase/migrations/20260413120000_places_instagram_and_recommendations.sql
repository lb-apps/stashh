-- Move recommendations from user_places to places; add instagram handle to places;
-- drop source_instagram_username from user_places.

-- 1. Add instagram handle column to places
alter table public.places
  add column if not exists instagram text;

comment on column public.places.instagram is 'Instagram username (handle without @) for this venue, when known';

-- 2. Add recommendations to places
alter table public.places
  add column if not exists recommendations jsonb not null default '[]'::jsonb;

comment on column public.places.recommendations is 'Creator recommendations extracted from recognition pipeline';

-- 3. Drop recommendations from user_places
alter table public.user_places
  drop column if exists recommendations;

-- 4. Drop source_instagram_username from user_places
alter table public.user_places
  drop column if exists source_instagram_username;
