import type { IGooglePlacesClient } from "../../services/google/google-places-client.js";
import type { ExtractedPlace, MatchedPlace } from "../../types/schemas.js";

async function matchPlace(
  extracted: ExtractedPlace,
  client: IGooglePlacesClient,
): Promise<MatchedPlace | null> {
  const query = extracted.location_hint
    ? `${extracted.name} ${extracted.location_hint}`
    : extracted.name;

  const place = await client.searchText(query, 1);
  if (!place) return null;

  return {
    google_place_id: place.id,
    name: place.displayName?.text ?? extracted.name,
    address: place.shortFormattedAddress ?? "",
    location:
      place.location?.latitude != null && place.location?.longitude != null
        ? { latitude: place.location.latitude, longitude: place.location.longitude }
        : null,
    rating: place.rating ?? null,
    first_photo_name: place.photos?.[0]?.name ?? null,
  };
}

export async function matchPlaces(
  places: ExtractedPlace[],
  client: IGooglePlacesClient,
): Promise<Map<string, MatchedPlace | null>> {
  const entries = await Promise.all(
    places.map(async (place) => {
      const matched = await matchPlace(place, client);
      return [place.name, matched] as const;
    }),
  );

  return new Map(entries);
}
