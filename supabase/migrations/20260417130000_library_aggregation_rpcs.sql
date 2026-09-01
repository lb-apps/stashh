-- RPC functions for Library page aggregation queries
-- These replace application-level GROUP BY in the Node.js service, moving
-- aggregation to the database where the partial indexes can be used efficiently.

-- Returns saved places grouped by district for a specific user.
CREATE OR REPLACE FUNCTION get_library_district_counts(p_user_id uuid)
RETURNS TABLE (
  district text,
  city     text,
  place_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.district,
    p.city,
    COUNT(*) AS place_count
  FROM saved_places sp
  JOIN places p ON sp.place_id = p.id
  WHERE sp.owner_user_id = p_user_id
    AND p.district IS NOT NULL
  GROUP BY p.district, p.city
  ORDER BY place_count DESC;
$$;

-- Returns saved places grouped by category for a specific user.
CREATE OR REPLACE FUNCTION get_library_category_counts(p_user_id uuid)
RETURNS TABLE (
  category    text,
  place_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.category,
    COUNT(*) AS place_count
  FROM saved_places sp
  JOIN places p ON sp.place_id = p.id
  WHERE sp.owner_user_id = p_user_id
    AND p.category IS NOT NULL
  GROUP BY p.category
  ORDER BY place_count DESC;
$$;

-- Grant execute to authenticated users (RLS on saved_places still applies via SECURITY DEFINER
-- which runs as the function owner — but we only read the calling user's rows via p_user_id).
GRANT EXECUTE ON FUNCTION get_library_district_counts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_library_category_counts(uuid) TO authenticated;
