"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./endpoints";
import type { SavedPlace } from "./types";

/** Cache keys — one place, so invalidations can't drift from reads. */
export const keys = {
  places: ["places"] as const,
  lists: ["lists"] as const,
  photos: (placeId: string) => ["photos", placeId] as const,
  me: ["me"] as const,
};

/** The reader's whole library, the single source for map, sheet, search and filters. */
export function usePlaces() {
  return useQuery({ queryKey: keys.places, queryFn: api.places.all });
}

export function usePlace(placeId: string | null): SavedPlace | undefined {
  const { data } = usePlaces();
  return placeId ? data?.find((p) => p.id === placeId) : undefined;
}

export function useLists() {
  return useQuery({ queryKey: keys.lists, queryFn: api.lists.all });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: Infinity });
}

/** Google photos of a saved place; places without a Google id have none to ask for. */
export function usePlacePhotos(place: SavedPlace | null, maxWidthPx: number) {
  const placeId = place?.google_place_id ? place.id : null;
  return useQuery({
    queryKey: keys.photos(placeId ?? ""),
    queryFn: async () => (await api.places.photos(placeId!, maxWidthPx)).urls,
    enabled: Boolean(placeId),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
