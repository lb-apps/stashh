-- Enable PostGIS extension (safe to run if already enabled)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add a WGS84 geography column for spatial queries
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS geo_location geography(Point, 4326);

-- Backfill from existing JSONB location data
UPDATE public.places
SET geo_location = ST_SetSRID(
  ST_MakePoint(
    (location->>'longitude')::double precision,
    (location->>'latitude')::double precision
  ),
  4326
)::geography
WHERE location IS NOT NULL
  AND location ? 'latitude'
  AND location ? 'longitude'
  AND (location->>'latitude')::double precision BETWEEN -90  AND 90
  AND (location->>'longitude')::double precision BETWEEN -180 AND 180;

-- GiST spatial index for fast ST_DWithin queries
CREATE INDEX IF NOT EXISTS places_geo_location_gist
  ON public.places
  USING GIST (geo_location);

-- Trigger function: keep geo_location in sync whenever location JSONB is written
CREATE OR REPLACE FUNCTION public.sync_places_geo_location()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location IS NOT NULL
     AND (NEW.location ? 'latitude')
     AND (NEW.location ? 'longitude')
     AND (NEW.location->>'latitude')::double precision  BETWEEN -90  AND 90
     AND (NEW.location->>'longitude')::double precision BETWEEN -180 AND 180
  THEN
    NEW.geo_location := ST_SetSRID(
      ST_MakePoint(
        (NEW.location->>'longitude')::double precision,
        (NEW.location->>'latitude')::double precision
      ),
      4326
    )::geography;
  ELSE
    NEW.geo_location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_places_geo_location ON public.places;
CREATE TRIGGER trg_sync_places_geo_location
  BEFORE INSERT OR UPDATE OF location
  ON public.places
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_places_geo_location();

-- ── RPC: list nearby saved places (returns rows ordered by distance) ─────────

CREATE OR REPLACE FUNCTION public.get_nearby_saved_places(
  p_user_id   uuid,
  p_lng       double precision,
  p_lat       double precision,
  p_radius_m  double precision DEFAULT 1000,
  p_category  text             DEFAULT NULL,
  p_limit     integer          DEFAULT 20,
  p_offset    integer          DEFAULT 0
)
RETURNS TABLE (
  saved_place_id        uuid,
  notes                 text,
  saved_at              timestamptz,
  id                    uuid,
  google_place_id       text,
  name                  text,
  address               text,
  short_formatted_address text,
  city                  text,
  district              text,
  country               text,
  location              jsonb,
  category              text,
  rating                numeric,
  rating_count          integer,
  price_level           integer,
  thumbnail_url         text,
  website_url           text,
  phone_number          text,
  google_maps_uri       text,
  business_status       text,
  types                 jsonb,
  opening_hours         jsonb,
  instagram_username    text,
  recommendations       jsonb,
  distance_m            double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    sp.id              AS saved_place_id,
    sp.notes,
    sp.created_at      AS saved_at,
    p.id,
    p.google_place_id,
    p.name,
    p.address,
    p.short_formatted_address,
    p.city,
    p.district,
    p.country,
    p.location,
    p.category,
    p.rating,
    p.rating_count,
    p.price_level,
    p.thumbnail_url,
    p.website_url,
    p.phone_number,
    p.google_maps_uri,
    p.business_status,
    p.types,
    p.opening_hours,
    p.instagram_username,
    p.recommendations,
    ST_Distance(p.geo_location, ref_point.geog) AS distance_m
  FROM public.saved_places sp
  JOIN public.places p ON p.id = sp.place_id
  CROSS JOIN LATERAL (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS geog
  ) ref_point
  WHERE sp.owner_user_id = p_user_id
    AND p.geo_location IS NOT NULL
    AND ST_DWithin(p.geo_location, ref_point.geog, p_radius_m)
    AND (p_category IS NULL OR p.category = p_category)
  ORDER BY distance_m ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- ── RPC: count nearby saved places (for pagination total_count) ───────────────

CREATE OR REPLACE FUNCTION public.count_nearby_saved_places(
  p_user_id   uuid,
  p_lng       double precision,
  p_lat       double precision,
  p_radius_m  double precision DEFAULT 1000,
  p_category  text             DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM public.saved_places sp
  JOIN public.places p ON p.id = sp.place_id
  CROSS JOIN LATERAL (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS geog
  ) ref_point
  WHERE sp.owner_user_id = p_user_id
    AND p.geo_location IS NOT NULL
    AND ST_DWithin(p.geo_location, ref_point.geog, p_radius_m)
    AND (p_category IS NULL OR p.category = p_category);
$$;
