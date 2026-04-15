-- Rename regular_opening_hours -> opening_hours on places table.

alter table public.places
  rename column regular_opening_hours to opening_hours;
