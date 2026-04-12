import type { RecognitionResultItem } from "../recognitions/service.js";
import type { Database } from "../../types/database.js";

type PlacesInsert = Database["public"]["Tables"]["places"]["Insert"];

export function recognitionItemToPlacesInsert(item: RecognitionResultItem): PlacesInsert {
  const p = item.place;
  return {
    google_place_id: p.googlePlaceId,
    name: p.name,
    address: p.address || null,
    city: null,
    district: null,
    country: null,
    location: null,
    category: null,
    rating: p.rating,
    price_level: null,
    phone_number: null,
    website_url: null,
    user_rating_count: null,
    business_status: null,
    google_maps_uri: null,
    types: null,
    regular_opening_hours: null,
    short_formatted_address: null,
    thumbnail_url: null,
    source_updated_at: new Date().toISOString(),
  };
}
