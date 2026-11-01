import type { MobileOS } from "@/lib/platform/in-app-browser";
import type { SavedPlace } from "@/lib/stashh/types";

/**
 * Where "Directions" goes. Apple Maps on iOS (the link opens the Maps app),
 * Google Maps everywhere else — the place's own Maps page when Google gave
 * one, otherwise a search pinned to its coordinates and place id.
 */
export function directionsHref(place: SavedPlace, os: MobileOS): string {
  const loc = place.location;
  const fallbackQuery = [place.name, place.address].filter(Boolean).join(", ");

  if (os === "ios") {
    const params = new URLSearchParams({ q: loc ? place.name : fallbackQuery });
    if (loc) params.set("ll", `${loc.latitude},${loc.longitude}`);
    return `https://maps.apple.com/?${params}`;
  }

  if (place.google_maps_uri) return place.google_maps_uri;
  const params = new URLSearchParams({ api: "1", query: loc ? `${loc.latitude},${loc.longitude}` : fallbackQuery });
  if (place.google_place_id) params.set("query_place_id", place.google_place_id);
  return `https://www.google.com/maps/search/?${params}`;
}
