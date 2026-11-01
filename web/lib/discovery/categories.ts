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

/** The category as a fill: a pale wash top-left deepening to the full pin colour. */
export function categoryGradient(category: PlaceCategory): string {
  const c = categoryColor(category);
  return `linear-gradient(152deg, color-mix(in srgb, ${c} 15%, transparent) 0%, ${c} 62%, color-mix(in srgb, ${c} 80%, transparent) 100%)`;
}
