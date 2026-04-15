import type { RecognitionResultPlace } from "../recognitions/service.js";
import type { Database, Json } from "../../types/database.js";
import type { GooglePlaceV1 } from "../../services/google/types.js";

type PlacesInsert = Database["public"]["Tables"]["places"]["Insert"];

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

type AddressComponent = { longText: string; types?: string[] };

/**
 * Google Places API address component types, ordered by semantic accuracy.
 *
 * city — "An incorporated city or town political entity" (Google docs).
 *   locality     → the only type Google explicitly defines as a city/town; covers
 *                  US, Germany, France, Japan, Brazil, India, and most of the world.
 *   postal_town  → UK grouping used instead of locality (e.g. "London").
 *   administrative_area_level_1 → last resort for countries where locality is
 *                  absent and level_1 represents the city itself (e.g. Turkey: "İstanbul",
 *                  Singapore, Hong Kong, city-states). Note: in federal countries (US, DE,
 *                  BR) level_1 = state — but locality is always present there so this
 *                  fallback is never reached.
 *
 * district — the sub-city area (neighbourhood / ilçe / arrondissement / ward).
 *   sublocality_level_1 → Turkey (ilçe: Şişli, Kadıköy), Japan (ku), India
 *   sublocality         → generic sub-city grouping
 *   neighborhood        → US, parts of EU
 *   administrative_area_level_2 → county/district level; used as district fallback
 *                  for countries where sublocality is absent (e.g. some Middle East).
 *                  In Turkey this correctly maps to ilçe when sublocality_level_1
 *                  is missing.
 */
const CITY_TYPES = [
  "locality",
  "postal_town",
  "administrative_area_level_1",
] as const;

const DISTRICT_TYPES = [
  "sublocality_level_1",
  "sublocality",
  "neighborhood",
  "administrative_area_level_2",
] as const;

function extractComponent(
  components: AddressComponent[] | undefined,
  types: readonly string[],
): string | null {
  if (!components) return null;
  for (const type of types) {
    const match = components.find((c) => c.types?.includes(type));
    if (match) return match.longText;
  }
  return null;
}

function extractOpeningHoursPeriods(hours: unknown): unknown[] | null {
  if (!hours || typeof hours !== "object") return null;
  const periods = (hours as Record<string, unknown>).periods;
  return Array.isArray(periods) ? periods : null;
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
    city: extractComponent(g.addressComponents, CITY_TYPES),
    district: extractComponent(g.addressComponents, DISTRICT_TYPES),
    country: extractComponent(g.addressComponents, ["country"]),
    location:
      lat !== 0 || lng !== 0
        ? { latitude: lat, longitude: lng }
        : null,
    category: g.primaryType ?? null,
    rating: g.rating ?? null,
    rating_count: g.userRatingCount ?? null,
    price_level: priceLevel,
    phone_number: g.nationalPhoneNumber ?? null,
    website_url: g.websiteUri ?? null,
    google_maps_uri: g.googleMapsUri ?? null,
    business_status: g.businessStatus?.toLowerCase() ?? null,
    types: (g.types ?? null) as Json | null,
    opening_hours: (g.regularOpeningHours != null ? extractOpeningHoursPeriods(g.regularOpeningHours) : null) as Json | null,
    thumbnail_url: null,
    instagram_username: null,
    recommendations: [],
    ...overrides,
  };
}

export function recognitionItemToPlacesInsert(item: RecognitionResultPlace): PlacesInsert {
  return {
    google_place_id: item.google_place_id,
    name: item.name,
    address: item.address || null,
    city: null,
    district: null,
    country: null,
    location: item.location ?? null,
    category: null,
    rating: item.rating,
    price_level: null,
    phone_number: null,
    website_url: null,
    rating_count: null,
    business_status: null,
    google_maps_uri: null,
    types: null,
    opening_hours: null,
    short_formatted_address: null,
    thumbnail_url: item.thumbnail_url ?? null,
    instagram_username: item.instagram_username ?? null,
    recommendations: (item.recommendations ?? []) as unknown as Json,
  };
}
