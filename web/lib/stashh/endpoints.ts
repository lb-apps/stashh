import { request, requestAll } from "./api";
import type {
  AddPlacesResult,
  BillingStatus,
  CategoryGroup,
  ListSummary,
  Me,
  PremiumPeriod,
  RecentRecognition,
  Recognition,
  SavedPlace,
} from "./types";

/**
 * One function per backend route — the web twin of iOS `APIEndpoint` +
 * repositories. Paths mirror `backend/src/modules/<domain>/routes.ts`; nothing
 * else in the app builds a URL.
 */
export const api = {
  places: {
    /** GET /places — every saved place, all pages. */
    all: () => requestAll<SavedPlace>("/places", { query: { sort: "recent" } }),
    /** GET /places/:id */
    get: (placeId: string) => request<SavedPlace>("GET", `/places/${placeId}`),
    /** GET /places/photos/:id */
    photos: (placeId: string, maxWidthPx: number) =>
      request<{ urls: string[] }>("GET", `/places/photos/${placeId}`, { query: { limit: 6, max_width_px: maxWidthPx } }),
    /** POST /places — saves recognised places to the library. */
    addFromRecognition: (recognitionResultId: string, googlePlaceIds: string[]) =>
      request<AddPlacesResult>("POST", "/places", {
        body: { source: "recognition", recognition_result_id: recognitionResultId, place_ids: googlePlaceIds },
      }),
    /** PATCH /places/:id */
    setNote: (placeId: string, notes: string | null) => request<SavedPlace>("PATCH", `/places/${placeId}`, { body: { notes } }),
    /** PUT / DELETE /places/:id/visit */
    setVisited: (placeId: string, visited: boolean) =>
      request<void>(visited ? "PUT" : "DELETE", `/places/${placeId}/visit`),
    /** DELETE /places/:id */
    remove: (placeId: string) => request<void>("DELETE", `/places/${placeId}`),
  },
  lists: {
    /** GET /lists */
    all: () => request<ListSummary[]>("GET", "/lists"),
    /** POST /lists */
    create: (body: { title: string; description: string | null; cover_category: CategoryGroup; place_ids: string[] }) =>
      request<ListSummary>("POST", "/lists", { body }),
    /** POST /lists/:id/places */
    addPlace: (listId: string, placeId: string) => request<unknown>("POST", `/lists/${listId}/places`, { body: { place_id: placeId } }),
  },
  recognitions: {
    /** POST /recognitions → 202 */
    start: (sourceUrl: string) => request<{ recognition_id: string }>("POST", "/recognitions", { body: { source_url: sourceUrl } }),
    /** GET /recognitions/:id — polled until terminal. */
    get: (recognitionId: string) => request<Recognition>("GET", `/recognitions/${recognitionId}`),
    /** GET /recognitions — the reader's latest, newest first. */
    recent: () => request<{ items: RecentRecognition[] }>("GET", "/recognitions", { query: { limit: 10 } }),
  },
  billing: {
    /** GET /billing — plan, today's allowance, credits and the tasks that earn them. */
    status: () => request<BillingStatus>("GET", "/billing"),
    /** POST /billing/sync — the plan RevenueCat gives now, right after a purchase; `503 PURCHASES_UNAVAILABLE` where purchases are off. */
    sync: () => request<BillingStatus>("POST", "/billing/sync"),
    /** POST /billing/mock-purchase — Premium without payment while the owner allows it; `403 PURCHASES_UNAVAILABLE` otherwise. */
    mockPurchase: (period: PremiumPeriod) => request<BillingStatus>("POST", "/billing/mock-purchase", { body: { period } }),
  },
  /** GET /me */
  me: () => request<Me>("GET", "/me"),
};
