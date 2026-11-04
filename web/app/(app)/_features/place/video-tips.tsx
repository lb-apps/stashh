"use client";

import * as React from "react";
import { Clock, Coffee, Footprints, HandPlatter, IceCreamCone, Martini, Sparkles, Utensils, type LucideIcon } from "lucide-react";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { useCopy } from "@/lib/i18n/provider";
import type { RecommendationKind } from "@/lib/types";
import type { SavedPlace, VenueRecommendation } from "@/lib/stashh/types";
import { placeSheetCopy } from "./copy";
import { Section } from "../shell/sheet-parts";
import { SECTION_GAP } from "./parts";

/** The tip's cobalt disc and its glyph. */
const DISC = 36;
const DISC_GLYPH = 18;

/** Each kind of tip and its glyph (the design's `REC_ICON`). */
const REC_ICON: Record<RecommendationKind, LucideIcon> = {
  dish: Utensils,
  drink: Coffee,
  cocktail: Martini,
  dessert: IceCreamCone,
  activity: Footprints,
  ordering: HandPlatter,
  timing: Clock,
  general: Sparkles,
};

/** What the video said to order, do or know, as the AI pulled it out. */
export function VideoTips({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  if (!place.recommendations.length) return null;

  return (
    <Section label={copy.fromTheVideo} style={{ marginTop: SECTION_GAP }}>
      <ul style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", margin: 0, padding: 0, listStyle: "none" }}>
        {place.recommendations.map((rec, i) => (
          <TipRow key={`${rec.kind}-${i}`} rec={rec} kindLabel={copy.recKind[rec.kind] ?? copy.recKind.general} />
        ))}
      </ul>
    </Section>
  );
}

function TipRow({ rec, kindLabel }: { rec: VenueRecommendation; kindLabel: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--sp-6)",
        padding: "var(--sp-7)",
        borderRadius: "var(--r-card)",
        background: "var(--cobalt-50)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
          width: DISC,
          height: DISC,
          borderRadius: "var(--r-sm)",
          background: "var(--fill-primary)",
          color: "var(--white)",
          boxShadow: "var(--gloss-top), var(--sh-cobalt-sm)",
        }}
      >
        <Glyph icon={REC_ICON[rec.kind] ?? Sparkles} size={DISC_GLYPH} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-micro)",
            lineHeight: "var(--lh-micro)",
            fontWeight: "var(--fw-heavy)",
            letterSpacing: "var(--tr-micro)",
            textTransform: "uppercase",
            color: "var(--cobalt-500)",
          }}
        >
          {kindLabel}
        </div>
        <p style={{ margin: "var(--sp-2) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--fs-body)", lineHeight: "var(--lh-body)", color: "var(--text-primary)" }}>
          {rec.summary}
        </p>
      </div>
    </li>
  );
}
