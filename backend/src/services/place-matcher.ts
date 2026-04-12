import { config } from "../config.js";
import type { ExtractedPlace, MatchedPlace } from "../types/schemas.js";

export async function matchPlace(extracted: ExtractedPlace): Promise<MatchedPlace | null> {
  const query = extracted.locationHint
    ? `${extracted.name} ${extracted.locationHint}`
    : extracted.name;

  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.photos",
  ].join(",");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
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
  });

  if (!response.ok) {
    console.error(
      `Places API error for "${query}": ${response.status} ${response.statusText}`,
    );
    return null;
  }

  const data = (await response.json()) as {
    places?: Array<{
      id: string;
      displayName?: { text: string };
      formattedAddress?: string;
      rating?: number;
      photos?: Array<{ name: string }>;
    }>;
  };
  const place = data.places?.[0];

  if (!place) return null;

  return {
    googlePlaceId: place.id,
    name: place.displayName?.text ?? extracted.name,
    address: place.formattedAddress ?? "",
    rating: place.rating ?? null,
    firstPhotoName: place.photos?.[0]?.name ?? null,
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
