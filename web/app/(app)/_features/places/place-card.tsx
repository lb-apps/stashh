"use client";

import * as React from "react";
import { OpenChip } from "@/lib/discovery/components/OpenChip";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "./category-glyph";
import { PlaceCaption, PlaceOrb } from "./place-parts";
import { usePlaceMeta } from "./use-place-meta";

/** Card width in px: a horizontal rail shows one and a half cards on a phone. */
const CARD_W = 214;
/** The orb straddles the photo's bottom edge, half over the photo. */
const ORB = 34;
const ORB_GLYPH = 15;

/**
 * A "Near you" card: 4:3 photo with the category orb on its bottom edge and
 * the open sign in its corner, then name, neighbourhood · category, and
 * rating · distance. The whole card opens the place.
 */
export function PlaceCard({ place, onOpen }: { place: SavedPlace; onOpen: (place: SavedPlace) => void }) {
  const meta = usePlaceMeta(place);
  const press = usePressable<HTMLButtonElement>();

  return (
    <button
      type="button"
      onClick={() => onOpen(place)}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "block",
        flex: "0 0 auto",
        width: CARD_W,
        borderRadius: "var(--r-field)",
        background: "var(--surface-card)",
        boxShadow: "var(--sh-card)",
        overflow: "hidden",
        textAlign: "left",
        ...press.style,
      }}
    >
      <PlacePhoto src={place.thumbnail_url} category={place.category_group} glyph={CATEGORY_GLYPH[place.category_group]} aspectRatio="4 / 3">
        <PlaceOrb place={place} size={ORB} glyphSize={ORB_GLYPH} style={{ left: "var(--sp-6)", bottom: -ORB / 2 }} />
        {meta.openLabel ? (
          <OpenChip open={meta.open === true} style={{ position: "absolute", left: "var(--sp-6)", top: "var(--sp-5)" }}>
            {meta.openLabel}
          </OpenChip>
        ) : null}
      </PlacePhoto>
      <PlaceCaption
        name={place.name}
        meta={meta}
        style={{ padding: `calc(${ORB / 2}px + var(--sp-4)) var(--sp-6) var(--sp-7)` }}
      />
    </button>
  );
}
