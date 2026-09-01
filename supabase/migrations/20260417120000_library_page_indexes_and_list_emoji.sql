-- Library page performance indexes and list emoji support

-- Partial index on places.district for GROUP BY aggregation (Library page districts section)
CREATE INDEX IF NOT EXISTS places_district_idx
  ON public.places (district)
  WHERE district IS NOT NULL;

-- Partial index on places.category for GROUP BY aggregation (Library page categories section)
CREATE INDEX IF NOT EXISTS places_category_idx
  ON public.places (category)
  WHERE category IS NOT NULL;

-- Compound index on saved_places for owner + created_at (supports paginated listing with recent sort)
CREATE INDEX IF NOT EXISTS saved_places_owner_created_idx
  ON public.saved_places (owner_user_id, created_at DESC);

-- Add emoji column to user_lists for displaying on library list cards
ALTER TABLE public.user_lists
  ADD COLUMN IF NOT EXISTS emoji text;

COMMENT ON COLUMN public.user_lists.emoji IS 'Emoji character displayed on the list card in the Library page';
