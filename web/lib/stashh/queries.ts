"use client";

import { useQuery } from "@tanstack/react-query";
import { useSignedInUserId } from "@/lib/auth/session";
import { loadPremiumOffers, subscriptionManagementUrl } from "@/lib/billing/purchases";
import { publicEnv } from "@/lib/env";
import { api } from "./endpoints";
import type { SavedPlace } from "./types";

/** Cache keys — one place, so invalidations can't drift from reads. */
export const keys = {
  places: ["places"] as const,
  lists: ["lists"] as const,
  photos: (placeId: string) => ["photos", placeId] as const,
  me: ["me"] as const,
  billing: ["billing"] as const,
  premiumOffers: (userId: string) => ["premium-offers", userId] as const,
  subscriptionManagement: (userId: string) => ["subscription-management", userId] as const,
};

const HOUR_MS = 60 * 60 * 1000;

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

/** Plan, today's allowance and credits. Analyses run in the DM, so a return to the app refetches it (window focus). */
export function useBilling() {
  return useQuery({ queryKey: keys.billing, queryFn: api.billing.status });
}

/**
 * Premium's prices from RevenueCat, where purchases are on (`NEXT_PUBLIC_REVENUECAT_API_KEY`)
 * and someone is signed in. The packages are the SDK's own objects, kept as they are.
 */
export function usePremiumOffers() {
  const userId = useSignedInUserId();
  return useQuery({
    queryKey: keys.premiumOffers(userId ?? ""),
    queryFn: () => loadPremiumOffers(userId!),
    enabled: Boolean(publicEnv.revenueCatApiKey && userId),
    staleTime: HOUR_MS,
    structuralSharing: false,
  });
}

/** Where someone on a purchased Premium changes or cancels it (Paddle's portal, through RevenueCat). */
export function useSubscriptionManagementUrl(enabled: boolean) {
  const userId = useSignedInUserId();
  return useQuery({
    queryKey: keys.subscriptionManagement(userId ?? ""),
    queryFn: () => subscriptionManagementUrl(userId!),
    enabled: Boolean(enabled && publicEnv.revenueCatApiKey && userId),
  });
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
