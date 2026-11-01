import { formatRating, placeDistance } from "@/lib/stashh/format";
import { isOpenNow } from "@/lib/stashh/selectors";
import type { LatLng, SavedPlace } from "@/lib/stashh/types";

/** What a card, tile or row says about a place beyond its name. Absent facts are null and not drawn. */
export interface PlaceMeta {
  /** "Moda · Coffee" — neighbourhood, then category. */
  subtitle: string;
  /** "4.6", or null when Google has no rating. */
  rating: string | null;
  /** "350 m", or null without the reader's position or the place's. */
  distance: string | null;
  /** Open right now; null when the hours are unknown. */
  open: boolean | null;
}

export interface PlaceMetaContext {
  categoryLabel: string;
  locale: string;
  origin: LatLng | null;
  now?: Date;
}

/** The neighbourhood (city when there is none) and the category, either alone when the other is unknown. */
export function placeSubtitle(place: SavedPlace, categoryLabel: string): string {
  return [place.district ?? place.city, categoryLabel].filter(Boolean).join(" · ");
}

export function placeMeta(place: SavedPlace, { categoryLabel, locale, origin, now = new Date() }: PlaceMetaContext): PlaceMeta {
  return {
    subtitle: placeSubtitle(place, categoryLabel),
    rating: place.rating != null ? formatRating(place.rating, locale) : null,
    distance: placeDistance(place, origin, locale),
    open: isOpenNow(place, now),
  };
}
