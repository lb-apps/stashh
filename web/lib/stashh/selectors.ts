import type { CategoryGroup, LatLng, OpeningPeriod, SavedPlace } from "./types";

/**
 * Pure derivations over the reader's library. The whole library is loaded once
 * (it is small), and search, filters, scopes and "near you" are computed here —
 * no request per keystroke or chip tap.
 */

const MINUTES_PER_WEEK = 7 * 24 * 60;

/** Minutes since Sunday 00:00 in the place's local time (Google's day 0 is Sunday). */
function localWeekMinute(now: Date, utcOffsetMinutes: number): number {
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  return local.getUTCDay() * 24 * 60 + local.getUTCHours() * 60 + local.getUTCMinutes();
}

function weekMinute(point: { day: number; hour: number; minute: number }): number {
  return point.day * 24 * 60 + point.hour * 60 + point.minute;
}

/**
 * Open right now? `null` when unknown (no hours, or no UTC offset to place
 * "now" in the venue's day). A period without `close` means open 24 hours.
 */
export function isOpenNow(place: SavedPlace, now = new Date()): boolean | null {
  const periods = place.opening_hours?.periods;
  if (!periods?.length || place.utc_offset_minutes == null) return null;
  const t = localWeekMinute(now, place.utc_offset_minutes);
  return periods.some((p: OpeningPeriod) => {
    if (!p.close) return true;
    const open = weekMinute(p.open);
    let close = weekMinute(p.close);
    if (close <= open) close += MINUTES_PER_WEEK;
    return (t >= open && t < close) || (t + MINUTES_PER_WEEK >= open && t + MINUTES_PER_WEEK < close);
  });
}

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Case- and accent-insensitive key in any script: "Kadıköy" ≈ "kadikoy", "Café" ≈ "cafe". */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .toLocaleLowerCase("en-US");
}

export function searchPlaces(places: SavedPlace[], query: string, categoryLabel: (c: CategoryGroup) => string): SavedPlace[] {
  const q = foldForSearch(query.trim());
  if (!q) return places;
  return places.filter((p) =>
    [p.name, p.district, p.city, categoryLabel(p.category_group)].some((field) => field && foldForSearch(field).includes(q)),
  );
}

export type Scope = "all" | "open" | "togo" | "been";
export type VisitFilter = "all" | "togo" | "been";
export type DistanceFilter = "any" | 1000 | 3000;

export interface PlaceFilters {
  listId: string | "all";
  category: CategoryGroup | "all";
  visit: VisitFilter;
  distance: DistanceFilter;
}

export const NO_FILTERS: PlaceFilters = { listId: "all", category: "all", visit: "all", distance: "any" };

export function isFiltered(filters: PlaceFilters): boolean {
  return filters.listId !== "all" || filters.category !== "all" || filters.visit !== "all" || filters.distance !== "any";
}

export function applyFilters(places: SavedPlace[], filters: PlaceFilters, origin: LatLng | null): SavedPlace[] {
  return places.filter((p) => {
    if (filters.listId !== "all" && !p.list_ids.includes(filters.listId)) return false;
    if (filters.category !== "all" && p.category_group !== filters.category) return false;
    if (filters.visit === "been" && !p.visited_at) return false;
    if (filters.visit === "togo" && p.visited_at) return false;
    if (filters.distance !== "any") {
      if (!origin || !p.location) return false;
      if (distanceMeters(origin, p.location) >= filters.distance) return false;
    }
    return true;
  });
}

export function applyScope(places: SavedPlace[], scope: Scope, now = new Date()): SavedPlace[] {
  switch (scope) {
    case "open":
      return places.filter((p) => isOpenNow(p, now) === true);
    case "togo":
      return places.filter((p) => !p.visited_at);
    case "been":
      return places.filter((p) => Boolean(p.visited_at));
    default:
      return places;
  }
}

/** Nearest first when there is an origin, newest saved first otherwise. */
export function sortNearYou(places: SavedPlace[], origin: LatLng | null): SavedPlace[] {
  if (!origin) return [...places].sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  const d = (p: SavedPlace) => (p.location ? distanceMeters(origin, p.location) : Number.POSITIVE_INFINITY);
  return [...places].sort((a, b) => d(a) - d(b));
}

/** `{ key, count }` buckets, largest first — "Browse by type", "By neighbourhood". */
export function countBy<K extends string>(places: SavedPlace[], key: (p: SavedPlace) => K | null): Array<{ key: K; count: number }> {
  const counts = new Map<K, number>();
  for (const p of places) {
    const k = key(p);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
}
