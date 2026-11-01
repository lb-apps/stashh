"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./endpoints";
import type { Recognition, RecognitionStatus, SavedPlace } from "./types";

/** Cache keys — one place, so invalidations can't drift from reads. */
export const keys = {
  places: ["places"] as const,
  lists: ["lists"] as const,
  recents: ["recognitions", "recent"] as const,
  recognition: (id: string) => ["recognitions", id] as const,
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

export function useRecentRecognitions() {
  return useQuery({ queryKey: keys.recents, queryFn: async () => (await api.recognitions.recent()).items });
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: Infinity });
}

export function usePlacePhotos(placeId: string | null, maxWidthPx: number) {
  return useQuery({
    queryKey: keys.photos(placeId ?? ""),
    queryFn: async () => (await api.places.photos(placeId!, maxWidthPx)).urls,
    enabled: Boolean(placeId),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

const TERMINAL: ReadonlySet<RecognitionStatus> = new Set(["completed", "committed", "failed", "expired", "cancelled"]);

export function isTerminal(recognition: Recognition | undefined): boolean {
  return recognition ? TERMINAL.has(recognition.status) : false;
}

/** Polls a recognition every 1.2 s until it settles. */
export function useRecognition(recognitionId: string | null) {
  return useQuery({
    queryKey: keys.recognition(recognitionId ?? ""),
    queryFn: () => api.recognitions.get(recognitionId!),
    enabled: Boolean(recognitionId),
    refetchInterval: (query) => (isTerminal(query.state.data) ? false : 1200),
  });
}
