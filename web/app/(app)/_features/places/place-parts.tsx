"use client";

import * as React from "react";
import { CategoryOrb } from "@/lib/discovery/components/CategoryOrb";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MetaDot } from "@/lib/discovery/components/MetaDot";
import { Rating } from "@/lib/discovery/components/Rating";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "./category-glyph";
import type { PlaceMetaView } from "./use-place-meta";

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/**
 * The text under a place's photo on cards and tiles: name, neighbourhood ·
 * category, then rating · distance. Spans only, so it can sit inside a button.
 */
export function PlaceCaption({ name, meta, style }: { name: string; meta: PlaceMetaView; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "block", minWidth: 0, ...style }}>
      <span
        style={{
          ...ellipsis,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-body)",
          lineHeight: "var(--lh-label)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--tr-tight)",
          color: "var(--text-primary)",
        }}
      >
        {name}
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
      {meta.rating || meta.distance ? (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
          {meta.rating ? <Rating value={meta.rating} label={meta.ratingLabel ?? undefined} /> : null}
          {meta.rating && meta.distance ? <MetaDot /> : null}
          {meta.distance ? (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--fs-micro)",
                lineHeight: "var(--lh-micro)",
                fontWeight: "var(--fw-heavy)",
                letterSpacing: "var(--tr-micro)",
                textTransform: "uppercase",
                color: TEXT_SECONDARY_STRONG,
                whiteSpace: "nowrap",
              }}
            >
              {meta.distance}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

/** The place's category orb with its glyph, for laying over a photo. */
export function PlaceOrb({ place, size, glyphSize, style }: { place: SavedPlace; size: number; glyphSize: number; style?: React.CSSProperties }) {
  return (
    <CategoryOrb category={place.category_group} size={size} style={{ position: "absolute", zIndex: 1, ...style }}>
      <Glyph icon={CATEGORY_GLYPH[place.category_group]} size={glyphSize} />
    </CategoryOrb>
  );
}
