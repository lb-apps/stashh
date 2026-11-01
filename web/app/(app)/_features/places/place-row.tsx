"use client";

import * as React from "react";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "./category-glyph";
import { usePlaceMeta } from "./use-place-meta";

/** Thumbnail size in px, and its stand-in glyph. */
const THUMB = 52;
const THUMB_GLYPH = 22;

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

type PlaceListRowProps = {
  place: SavedPlace;
  onOpen: (place: SavedPlace) => void;
  /**
   * Replaces the distance at the end of the row — e.g. the list's "been there"
   * toggle. It sits outside the row's button, so it may be a control itself.
   */
  trailing?: React.ReactNode;
};

/**
 * A place in a vertical list (search results, library, list detail): photo
 * thumbnail, name, neighbourhood · category, and the distance. Composed from
 * the atoms rather than Discovery's `PlaceRow`, which draws a category disc
 * where these rows show the photo, and is not a button.
 */
export function PlaceListRow({ place, onOpen, trailing }: PlaceListRowProps) {
  const meta = usePlaceMeta(place);
  const press = usePressable<HTMLButtonElement>();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-6)",
        padding: trailing ? "0 var(--sp-7) 0 0" : 0,
        borderRadius: "var(--r-card-lg)",
        background: "var(--surface-sunken)",
      }}
    >
      <button
        type="button"
        onClick={() => onOpen(place)}
        {...press.handlers}
        style={{
          ...BUTTON_RESET,
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-6)",
          flex: 1,
          minWidth: 0,
          minHeight: "var(--hit-min)",
          padding: "var(--sp-6) var(--sp-7)",
          borderRadius: "var(--r-card-lg)",
          textAlign: "left",
          ...press.style,
        }}
      >
        <PlacePhoto
          src={place.thumbnail_url}
          category={place.category_group}
          glyph={CATEGORY_GLYPH[place.category_group]}
          glyphSize={THUMB_GLYPH}
          width={THUMB}
          height={THUMB}
          radius="var(--r-field)"
          raised
        />
        <span style={{ display: "block", flex: 1, minWidth: 0 }}>
          <span
            style={{
              ...ellipsis,
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-headline)",
              lineHeight: "var(--lh-headline)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "var(--tr-tight)",
              color: "var(--text-primary)",
            }}
          >
            {place.name}
          </span>
          {meta.subtitle ? (
            <span
              style={{
                ...ellipsis,
                marginTop: "var(--sp-1)",
                fontFamily: "var(--font-text)",
                fontSize: "var(--fs-caption)",
                lineHeight: "var(--lh-caption)",
                color: TEXT_SECONDARY_STRONG,
              }}
            >
              {meta.subtitle}
            </span>
          ) : null}
        </span>
        {!trailing && meta.distance ? (
          <span
            style={{
              flex: "0 0 auto",
              fontFamily: "var(--font-rounded)",
              fontSize: "var(--fs-caption)",
              lineHeight: "var(--lh-caption)",
              fontWeight: "var(--fw-black)",
              fontVariantNumeric: "tabular-nums",
              color: TEXT_SECONDARY_STRONG,
            }}
          >
            {meta.distance}
          </span>
        ) : null}
      </button>
      {trailing}
    </div>
  );
}
