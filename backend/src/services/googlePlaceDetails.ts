import { config } from "../config.js";
import type { Database, Json } from "../types/database.js";

type PlacesInsert = Database["public"]["Tables"]["places"]["Insert"];

/** Google Places API (New) GET place response subset */
interface GooglePlaceV1 {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: Array<{ longText: string; types?: string[] }>;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  regularOpeningHours?: unknown;
  photos?: Array<{ name: string }>;
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function extractComponent(
  components: Array<{ longText: string; types?: string[] }> | undefined,
  type: string,
): string | null {
  return components?.find((c) => c.types?.includes(type))?.longText ?? null;
}

const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "addressComponents",
  "location",
  "primaryType",
  "types",
  "rating",
  "userRatingCount",
  "priceLevel",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "businessStatus",
  "regularOpeningHours",
  "photos",
].join(",");

/**
 * Fetches full place details from Google when the place is not present in recognition cache.
 */
export async function fetchGooglePlaceDetails(googlePlaceId: string): Promise<GooglePlaceV1 | null> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
    },
  });
  if (!response.ok) {
    console.error(
      `[googlePlaceDetails] ${googlePlaceId}: ${response.status} ${response.statusText}`,
    );
    return null;
  }
  return (await response.json()) as GooglePlaceV1;
}

export function mapGooglePlaceV1ToPlacesInsert(
  g: GooglePlaceV1,
  overrides: Partial<PlacesInsert> = {},
): PlacesInsert {
  const lat = g.location?.latitude ?? 0;
  const lng = g.location?.longitude ?? 0;
  const priceLevel = g.priceLevel ? (PRICE_LEVEL_MAP[g.priceLevel] ?? null) : null;

  return {
    google_place_id: g.id ?? null,
    name: g.displayName?.text ?? "Unknown place",
    address: g.formattedAddress ?? null,
    short_formatted_address: g.shortFormattedAddress ?? null,
    city: extractComponent(g.addressComponents, "locality"),
    district: extractComponent(g.addressComponents, "sublocality"),
    country: extractComponent(g.addressComponents, "country"),
    location:
      lat !== 0 || lng !== 0
        ? { latitude: lat, longitude: lng }
        : null,
    category: g.primaryType ?? null,
    rating: g.rating ?? null,
    user_rating_count: g.userRatingCount ?? null,
    price_level: priceLevel,
    phone_number: g.nationalPhoneNumber ?? null,
    website_url: g.websiteUri ?? null,
    google_maps_uri: g.googleMapsUri ?? null,
    business_status: g.businessStatus ?? null,
    types: (g.types ?? null) as Json | null,
    regular_opening_hours: (g.regularOpeningHours ?? null) as Json | null,
    thumbnail_url: null,
    source_updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Fetches only photo names for on-demand gallery (fresh URLs via media API).
 */
export async function fetchGooglePlacePhotosField(googlePlaceId: string): Promise<string[]> {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": "photos",
    },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { photos?: Array<{ name: string }> };
  return (data.photos ?? []).map((p) => p.name).filter(Boolean);
}
