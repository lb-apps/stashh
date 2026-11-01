import type { CategoryGroup, LatLng, OpeningPeriod, SavedPlace } from "./types";

/**
 * Pure derivations over the reader's library. The whole library is loaded once
 * (it is small), and search, filters, scopes and "near you" are computed here —
 * no request per keystroke or chip tap.
 */

export const MINUTES_PER_DAY = 24 * 60;
export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** A point in Google's week (day 0 = Sunday) as minutes since Sunday 00:00. */
export function weekMinute(point: { day: number; hour: number; minute: number }): number {
  return point.day * MINUTES_PER_DAY + point.hour * 60 + point.minute;
}

/**
 * The venue's UTC offset. Places saved before the backend stored it fall back
 * to the reader's own offset — saved places are nearly always in the reader's
 * own city, and a wrong guess there costs one chip.
 */
export function venueOffset(utcOffsetMinutes: number | null, now: Date): number {
  return utcOffsetMinutes ?? -now.getTimezoneOffset();
}

/** "Now" as minutes since Sunday 00:00 in the venue's local time. */
export function localWeekMinute(now: Date, utcOffsetMinutes: number): number {
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  return weekMinute({ day: local.getUTCDay(), hour: local.getUTCHours(), minute: local.getUTCMinutes() });
}

/**
 * Whether a period covers the week minute `t`, including one that wraps past
 * Saturday night. A period with no close is Google's "open around the clock".
 */
export function periodCovers(period: OpeningPeriod, t: number): boolean {
  if (!period.close) return true;
  const open = weekMinute(period.open);
  let close = weekMinute(period.close);
  if (close <= open) close += MINUTES_PER_WEEK;
  return (t >= open && t < close) || (t + MINUTES_PER_WEEK >= open && t + MINUTES_PER_WEEK < close);
}

/** Open right now? `null` when there are no hours. "Now" is placed in the venue's day by its UTC offset. */
export function isOpenNow(place: SavedPlace, now = new Date()): boolean | null {
  const periods = place.opening_hours;
  if (!periods?.length) return null;
  const t = localWeekMinute(now, venueOffset(place.utc_offset_minutes, now));
  return periods.some((p) => periodCovers(p, t));
}

/** Newest saved first. */
export function newestFirst(places: SavedPlace[]): SavedPlace[] {
  return [...places].sort((a, b) => b.saved_at.localeCompare(a.saved_at));
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
