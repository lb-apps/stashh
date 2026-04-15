-- recognition_results: rename `items` → `places` and flatten structure.
-- Old shape:  items = [{ confidence_score, place: { ... } }]
-- New shape:  places = [{ google_place_id, name, address, ... }]

-- 1. Add new column
alter table public.recognition_results
  add column if not exists places jsonb not null default '[]'::jsonb;

-- 2. Migrate existing data: unwrap .place object, drop confidence_score
update public.recognition_results
set places = (
  select coalesce(
    jsonb_agg(elem -> 'place'),
    '[]'::jsonb
  )
  from jsonb_array_elements(items) as elem
)
where jsonb_array_length(items) > 0;

-- 3. Drop old column
alter table public.recognition_results
  drop column items;
