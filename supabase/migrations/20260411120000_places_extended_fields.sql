-- Extended canonical fields for places + optional Instagram handle on user_places.

alter table public.places
  add column if not exists user_rating_count integer,
  add column if not exists business_status text,
  add column if not exists google_maps_uri text,
  add column if not exists types jsonb,
  add column if not exists regular_opening_hours jsonb,
  add column if not exists short_formatted_address text;

alter table public.user_places
  add column if not exists source_instagram_username text;

comment on column public.places.user_rating_count is 'Google Places userRatingCount';
comment on column public.places.business_status is 'Google Places businessStatus';
comment on column public.places.google_maps_uri is 'Google Places googleMapsUri';
comment on column public.places.types is 'Google Places types array';
comment on column public.places.regular_opening_hours is 'Google Places regularOpeningHours JSON';
comment on column public.places.short_formatted_address is 'Google Places shortFormattedAddress';
comment on column public.user_places.source_instagram_username is 'Instagram @ from recognition, when available';
