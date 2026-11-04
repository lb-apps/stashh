"use client";

import * as React from "react";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { useCopy } from "@/lib/i18n/provider";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { placeSheetCopy } from "./copy";
import { SECTION_GAP } from "./parts";

/** Strip photo height, and widths: the lead photo wider, so the strip reads as scrollable. */
const PHOTO_H = 170;
const LEAD_W = 240;
const PHOTO_W = 160;

/**
 * The place's photos in a horizontal, snapping strip that runs to the sheet's
 * edges. Drawn only when there is a photo — the header already shows the
 * category stand-in.
 */
export function PhotoStrip({ place, photos }: { place: SavedPlace; photos: string[] }) {
  const copy = useCopy(placeSheetCopy);
  if (!photos.length) return null;

  return (
    <ul
      aria-label={copy.photos(place.name)}
      className="ds-scroll-hide"
      style={{
        display: "flex",
        gap: "var(--sp-6)",
        margin: `${SECTION_GAP} calc(-1 * var(--gutter)) 0`,
        padding: "0 var(--gutter) var(--sp-4)",
        listStyle: "none",
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        scrollPaddingInline: "var(--gutter)",
        overscrollBehaviorX: "contain",
        touchAction: "pan-x pan-y",
      }}
    >
      {photos.map((src, i) => (
        <li key={src} style={{ flex: "0 0 auto", scrollSnapAlign: "start" }}>
          <PlacePhoto
            src={src}
            alt={place.name}
            category={place.category_group}
            glyph={CATEGORY_GLYPH[place.category_group]}
            width={i === 0 ? LEAD_W : PHOTO_W}
            height={PHOTO_H}
            radius="var(--r-card)"
            raised
          />
        </li>
      ))}
    </ul>
  );
}
