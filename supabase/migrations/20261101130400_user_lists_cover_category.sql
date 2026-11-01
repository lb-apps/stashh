-- A list's cover: one of the place category groups, drawn as the list's art.
-- Same values as the API's `category_group` (backend/src/modules/places/mapper.ts).

alter table public.user_lists
  add column cover_category text
    check (cover_category is null or cover_category in (
      'coffee', 'food', 'bar', 'rooftop', 'sweets', 'bakery', 'wine', 'park', 'view', 'market', 'default'
    ));

comment on column public.user_lists.cover_category is
  'Category group drawn on the list cover; null for the default art.';
