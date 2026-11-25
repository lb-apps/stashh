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

/** "in 3 hours" / "3 saat sonra": how long until `at`, rounded up to the minute, then to the hour. */
export function formatUntil(at: string, locale: string, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(at) - now.getTime()) / 60_000));
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  return minutes < 60 ? relative.format(minutes, "minute") : relative.format(Math.ceil(minutes / 60), "hour");
}

/** "₺129,99" / "$3.99": an amount in micro-units of its currency, in the reader's locale. */
export function formatMoney(amountMicros: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountMicros / 1_000_000);
}

/** "25 December 2026" / "25 Aralık 2026" */
export function formatDay(at: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(at));
}

/** Google price level 0–4 as currency marks ("₺₺"); null when unknown or free. */
export function formatPriceLevel(level: number | null, currencySymbol: string): string | null {
  return level ? currencySymbol.repeat(level) : null;
}
