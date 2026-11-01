-- The place's UTC offset, from Google (utcOffsetMinutes), so a client can tell whether it
-- is open now from `opening_hours` periods, which are in the place's local time.
-- Null until the place is next enriched from Google.

alter table public.places
  add column utc_offset_minutes smallint
    check (utc_offset_minutes is null or utc_offset_minutes between -720 and 840);

comment on column public.places.utc_offset_minutes is
  'Offset of the place''s local time from UTC in minutes (Google utcOffsetMinutes); null when not yet known.';
