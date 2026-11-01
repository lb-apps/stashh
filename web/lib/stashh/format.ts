import type { LatLng, SavedPlace } from "./types";
import { distanceMeters } from "./selectors";

/** "350 m", "2.1 km" in the reader's locale (`Intl` units, so "2,1 km" in Turkish). */
export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) {
    return new Intl.NumberFormat(locale, { style: "unit", unit: "meter", maximumFractionDigits: 0 }).format(Math.round(meters / 10) * 10);
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: "kilometer", maximumFractionDigits: meters < 10_000 ? 1 : 0 }).format(
    meters / 1000,
  );
}

/** Distance from `origin` to a place, formatted; null when either is unknown. */
export function placeDistance(place: SavedPlace, origin: LatLng | null, locale: string): string | null {
  return origin && place.location ? formatDistance(distanceMeters(origin, place.location), locale) : null;
}

/** "4.6" — one decimal, locale separator. */
export function formatRating(rating: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rating);
}

/** "1,284" / "1.284" */
export function formatCount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** Google price level 0–4 as currency marks ("₺₺"); null when unknown or free. */
export function formatPriceLevel(level: number | null, currencySymbol: string): string | null {
  return level ? currencySymbol.repeat(level) : null;
}
