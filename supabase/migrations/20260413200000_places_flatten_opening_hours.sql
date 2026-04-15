-- Flatten opening_hours from {periods: [...], ...} object to a bare array.
-- Rows that already hold a JSON array are left untouched.

update public.places
set opening_hours = opening_hours -> 'periods'
where opening_hours is not null
  and jsonb_typeof(opening_hours) = 'object'
  and opening_hours ? 'periods';
