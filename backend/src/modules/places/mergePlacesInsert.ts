import type { Database } from "../../types/database.js";

type PlacesInsert = Database["public"]["Tables"]["places"]["Insert"];

function isEmptyLocation(loc: unknown): boolean {
  if (loc === null || loc === undefined) return true;
  if (typeof loc !== "object") return true;
  const o = loc as { latitude?: number; longitude?: number };
  return (o.latitude ?? 0) === 0 && (o.longitude ?? 0) === 0;
}

function isEmptyPlaceValue(key: keyof PlacesInsert, val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (key === "location") return isEmptyLocation(val);
  return false;
}

/**
 * Starts from recognition/partial row; fills any empty columns from Places API (New) mapping.
 * Does not overwrite non-empty recognition fields.
 */
export function backfillPlacesInsertFromApi(partial: PlacesInsert, api: PlacesInsert): PlacesInsert {
  const keys: (keyof PlacesInsert)[] = [
    "name",
    "address",
    "short_formatted_address",
    "city",
    "district",
    "country",
    "location",
    "category",
    "rating",
    "rating_count",
    "price_level",
    "phone_number",
    "website_url",
    "google_maps_uri",
    "business_status",
    "types",
    "opening_hours",
    "thumbnail_url",
  ];

  const result: PlacesInsert = { ...partial };
  result.google_place_id = partial.google_place_id ?? api.google_place_id;

  for (const key of keys) {
    if (isEmptyPlaceValue(key, result[key])) {
      const fill = api[key];
      if (!isEmptyPlaceValue(key, fill)) {
        (result as Record<string, unknown>)[key as string] = fill as unknown;
      }
    }
  }

  return result;
}
