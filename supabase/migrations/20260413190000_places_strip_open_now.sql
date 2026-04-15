-- Strip openNow from existing opening_hours values; it is computed client-side.

update public.places
set opening_hours = opening_hours - 'openNow'
where opening_hours is not null
  and opening_hours ? 'openNow';
