"use client";

import * as React from "react";
import { Clapperboard } from "lucide-react";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { RecentRecognition } from "@/lib/stashh/types";

/** Cover thumbnail and its stand-in glyph, in px. */
const THUMB = 54;
const THUMB_GLYPH = 22;

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/**
 * A Reel the reader sent: its cover, who posted it, and what came of it. The
 * whole row opens it — the recognition progress, or the places it found.
 */
export function ReelRow({
  reel,
  title,
  meta,
  onOpen,
}: {
  reel: RecentRecognition;
  title: string;
  meta: string;
  onOpen: (reel: RecentRecognition) => void;
}) {
  const press = usePressable<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={() => onOpen(reel)}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-6)",
        width: "100%",
        minHeight: "var(--hit-min)",
        borderRadius: "var(--r-field)",
        textAlign: "left",
        ...press.style,
      }}
    >
      <PlacePhoto
        src={reel.source_thumbnail_url}
        category="default"
        glyph={Clapperboard}
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
            fontSize: "var(--fs-body)",
            lineHeight: "var(--lh-label)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "var(--tr-tight)",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </span>
        <span className="ds-caption" style={{ ...ellipsis, marginTop: "var(--sp-1)", color: TEXT_SECONDARY_STRONG }}>
          {meta}
        </span>
      </span>
    </button>
  );
}
