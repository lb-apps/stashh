"use client";

import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePosition } from "@/lib/platform/location";
import type { SavedPlace } from "@/lib/stashh/types";
import { placeCopy } from "./copy";
import { placeMeta, type PlaceMeta } from "./place-meta";

export interface PlaceMetaView extends PlaceMeta {
  /** "Open" / "Closed", or null when the hours are unknown. */
  openLabel: string | null;
  /** Spoken name of the rating ("Rated 4.6"). */
  ratingLabel: string | null;
}

/** `placeMeta` in the reader's locale, from their position, with its labels. */
export function usePlaceMeta(place: SavedPlace): PlaceMetaView {
  const t = useT();
  const copy = useCopy(placeCopy);
  const locale = useIntlLocale();
  const origin = usePosition();
  const meta = placeMeta(place, { categoryLabel: t.categories[place.category_group], locale, origin });
  return {
    ...meta,
    openLabel: meta.open == null ? null : meta.open ? copy.open : copy.closed,
    ratingLabel: meta.rating ? copy.rated(meta.rating) : null,
  };
}
