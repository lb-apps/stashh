"use client";

import * as React from "react";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "./category-glyph";
import { PlaceCaption, PlaceSticker } from "./place-parts";
import { usePlaceMeta } from "./use-place-meta";

/** Tile width in px; the photo is square at the same size. */
const TILE_W = 158;
const STICKER = { width: 34, height: 29, glyph: 16 } as const;

/**
 * A "Saved spots" tile: a free-standing square photo with the category sticker in
 * its corner, then the same caption as a card. The whole tile opens the place.
 */
export function PlaceTile({ place, onOpen }: { place: SavedPlace; onOpen: (place: SavedPlace) => void }) {
  const meta = usePlaceMeta(place);
  const press = usePressable<HTMLButtonElement>();

  return (
    <button
      type="button"
      onClick={() => onOpen(place)}
      {...press.handlers}
      style={{ ...BUTTON_RESET, display: "block", flex: "0 0 auto", width: TILE_W, textAlign: "left", borderRadius: "var(--r-cta)", ...press.style }}
    >
      <PlacePhoto
        src={place.thumbnail_url}
        category={place.category_group}
        glyph={CATEGORY_GLYPH[place.category_group]}
        height={TILE_W}
        radius="var(--r-cta)"
        raised
      >
        <PlaceSticker place={place} width={STICKER.width} height={STICKER.height} glyphSize={STICKER.glyph} style={{ left: "var(--sp-7)", bottom: "var(--sp-6)" }} />
      </PlacePhoto>
      <PlaceCaption name={place.name} meta={meta} style={{ marginTop: "var(--sp-5)" }} />
    </button>
  );
}
