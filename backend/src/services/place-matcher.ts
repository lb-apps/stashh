import { config } from "../config.js";
import type { ExtractedPlace, MatchedPlace } from "../types/schemas.js";
import { uploadPlaceThumbnail } from "./place-thumbnail.js";

interface PlacesTextSearchResult {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    priceLevel?: string;
    primaryType?: string;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    photos?: Array<{ name: string }>;
    addressComponents?: Array<{
      longText: string;
      types?: string[];       // API may omit this field on some components
    }>;
  }>;
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

export async function matchPlace(
  extracted: ExtractedPlace,
): Promise<MatchedPlace | null> {
  const query = extracted.locationHint
    ? `${extracted.name} ${extracted.locationHint}`
    : extracted.name;

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.rating",
    "places.priceLevel",
    "places.primaryType",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.photos",
    "places.addressComponents",
  ].join(",");

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: 1,
      }),
    },
  );

  if (!response.ok) {
    console.error(
      `Places API error for "${query}": ${response.status} ${response.statusText}`,
    );
    return null;
  }

  const data = (await response.json()) as PlacesTextSearchResult;
  const place = data.places?.[0];

  if (!place) return null;

  const thumbnailUrl = place.photos?.[0]
    ? await uploadPlaceThumbnail(place.id, place.photos[0].name)
    : null;

  return {
    googlePlaceId: place.id,
    name: place.displayName?.text ?? extracted.name,
    address: place.formattedAddress ?? "",
    city: extractComponent(place.addressComponents, "locality"),
    district: extractComponent(place.addressComponents, "sublocality"),
    country: extractComponent(place.addressComponents, "country"),
    latitude: place.location?.latitude ?? 0,
    longitude: place.location?.longitude ?? 0,
    category: place.primaryType ?? null,
    rating: place.rating ?? null,
    priceLevel: place.priceLevel ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null) : null,
    thumbnailUrl,
    phoneNumber: place.nationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
  };
}

export async function matchPlaces(
  places: ExtractedPlace[],
): Promise<Map<string, MatchedPlace | null>> {
  const entries = await Promise.all(
    places.map(async (place) => {
      const matched = await matchPlace(place);
      return [place.name, matched] as const;
    }),
  );

  return new Map(entries);
}
