"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import { useCopy } from "@/lib/i18n/provider";
import { useSetVisited } from "@/lib/stashh/mutations";
import type { SavedPlace } from "@/lib/stashh/types";
import { listCopy } from "./copy";

/**
 * The "been there" tick at the end of a list row: a glossy circle that turns
 * the selected green when visited. Optimistic — the row flips on tap.
 */
export function VisitedToggle({ place }: { place: SavedPlace }) {
  const copy = useCopy(listCopy);
  const setVisited = useSetVisited();
  const press = usePressable<HTMLButtonElement>({}, "var(--press-scale-tight)");
  const visited = Boolean(place.visited_at);

  return (
    <button
      type="button"
      aria-pressed={visited}
      aria-label={copy.beenTo(place.name)}
      onClick={() => setVisited.mutate({ placeId: place.id, visited: !visited })}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        width: "var(--hit-min)",
        height: "var(--hit-min)",
        borderRadius: "var(--r-circle)",
        background: visited ? "var(--fill-selected)" : "var(--surface-field)",
        color: visited ? "var(--white)" : TEXT_SECONDARY_STRONG,
        boxShadow: "var(--gloss-top)",
        ...press.style,
        transition: "transform var(--dur-fast) var(--ease-spring), background var(--dur-fast) var(--ease-out)",
      }}
    >
      <Glyph icon={Check} />
    </button>
  );
}
