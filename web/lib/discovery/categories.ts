/**
 * Place categories — the pin palette. Each is a `--pin-*` colour token; the
 * glyph for each lives with the caller (Lucide names differ by surface).
 */
export const PLACE_CATEGORIES = [
  'coffee',
  'food',
  'bar',
  'rooftop',
  'sweets',
  'bakery',
  'wine',
  'park',
  'view',
  'market',
  'default',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

/** `var(--pin-<category>)` */
export function categoryColor(category: PlaceCategory): string {
  return `var(--pin-${category})`;
}
