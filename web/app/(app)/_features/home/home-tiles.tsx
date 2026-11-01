"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";

/** The circle in front of the scope pills, and the new-list tile's plus disc, in px. */
const DISC = 36;
/** Dashed outline width of the new-list tile, in px. */
const DASH = 2;

/** The round search button that leads the scope pills. */
export function SearchCircle({ label, onClick }: { label: string; onClick: () => void }) {
  const press = usePressable<HTMLButtonElement>({}, "var(--press-scale-tight)");
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        width: "var(--hit-min)",
        height: "var(--hit-min)",
        borderRadius: "var(--r-circle)",
        background: "var(--surface-sunken-on-white)",
        color: "var(--text-primary)",
        ...press.style,
      }}
    >
      <Glyph icon={Search} />
    </button>
  );
}

/**
 * "New list", beside the My spots tile: the same shape drawn as an empty slot —
 * a dashed outline and a cobalt plus — so it reads as a place to add one.
 */
export function NewListTile({ label, onClick }: { label: string; onClick: () => void }) {
  const press = usePressable<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-5)",
        width: "100%",
        minWidth: 0,
        minHeight: "var(--hit-min)",
        padding: `calc(var(--sp-5) - ${DASH}px) calc(var(--sp-6) - ${DASH}px)`,
        borderRadius: "var(--r-field)",
        border: `${DASH}px dashed var(--grey-300)`,
        textAlign: "left",
        ...press.style,
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
          borderRadius: "var(--r-circle)",
          background: "var(--surface-sunken-on-white)",
          color: "var(--cobalt-500)",
        }}
      >
        <Glyph icon={Plus} />
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-body)",
          lineHeight: "var(--lh-label)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--tr-tight)",
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </button>
  );
}
