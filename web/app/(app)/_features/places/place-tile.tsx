"use client";

import * as React from "react";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "./category-glyph";
import { PlaceCaption, PlaceOrb } from "./place-parts";
import { usePlaceMeta } from "./use-place-meta";

/** Tile width in px; the photo is square at the same size. */
const TILE_W = 158;
const ORB = 32;
const ORB_GLYPH = 16;

/**
 * A "Saved spots" tile: a free-standing square photo with the category orb in
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
        <PlaceOrb place={place} size={ORB} glyphSize={ORB_GLYPH} style={{ left: "var(--sp-5)", bottom: "var(--sp-5)" }} />
      </PlacePhoto>
      <PlaceCaption name={place.name} meta={meta} style={{ marginTop: "var(--sp-5)" }} />
    </button>
  );
}
