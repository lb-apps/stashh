"use client";

import * as React from "react";
import { MAP_PIN } from "@/lib/discovery/components/MapPin";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { Area } from "@/lib/stashh/selectors";
import { staticMapUrl } from "../map/static-map";

/** Tile sizes in px: the neighbourhood with the most saves leads, wider than the rest. */
const TILE_H = 136;
const TILE_W = { lead: 212, rest: 138 } as const;
/** The "see all" slot at the end of the rail, and its dashed outline, in px. */
const ALL_W = 96;
const DASH = 2;
/** The name chip: its height and its inset from the tile's edges, in px. */
const CHIP_H = 32;
const CHIP_INSET = 9;
/** The pin's width in px. */
const PIN = 22;

/**
 * A neighbourhood (or a city) on a rail: a small map centred on its places, a
 * pin at that centre, and its name and count on a chip. The whole tile opens its places.
 */
export function NeighbourhoodTile({
  area,
  lead,
  zoom,
  count,
  label,
  onOpen,
}: {
  area: Area;
  lead: boolean;
  /** The map's zoom; a neighbourhood's by default. */
  zoom?: number;
  count: string;
  /** What a screen reader hears: the name and the count in words. */
  label: string;
  onOpen: (area: Area) => void;
}) {
  const press = usePressable<HTMLButtonElement>();
  const width = lead ? TILE_W.lead : TILE_W.rest;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onOpen(area)}
      {...press.handlers}
      style={{ ...BUTTON_RESET, display: "block", flex: "0 0 auto", width, textAlign: "left", borderRadius: "var(--r-field)", ...press.style }}
    >
      <PlacePhoto
        src={staticMapUrl(area.centre, width, TILE_H, zoom)}
        category="default"
        height={TILE_H}
        radius="var(--r-field)"
        style={{ background: "var(--bone-200)", boxShadow: "var(--sh-thumb)", overflow: "hidden" }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: PIN,
            height: PIN,
            // A square with one near-sharp corner, turned so that corner points down at the centre of the map.
            borderRadius: "50% 50% 50% var(--sp-1)",
            background: "var(--fill-primary)",
            boxShadow: `var(--gloss-top), 0 0 0 ${MAP_PIN.ring}px var(--white), var(--sh-pin)`,
            transform: `translate(-50%, -50%) translateY(${-PIN * Math.SQRT1_2}px) rotate(-45deg)`,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetInline: CHIP_INSET,
            bottom: CHIP_INSET,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--sp-3)",
            height: CHIP_H,
            padding: "0 var(--sp-6)",
            borderRadius: "var(--r-pill)",
            background: "var(--material-chip)",
            backdropFilter: "var(--material-blur)",
            WebkitBackdropFilter: "var(--material-blur)",
            boxShadow: "var(--sh-float)",
          }}
        >
          <span
            style={{
              minWidth: 0,
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-caption)",
              lineHeight: 1,
              fontWeight: "var(--fw-heavy)",
              letterSpacing: "var(--tr-tight)",
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {area.name}
          </span>
          <span
            style={{
              flex: "0 0 auto",
              fontFamily: "var(--font-rounded)",
              fontSize: "var(--fs-micro)",
              lineHeight: 1,
              fontWeight: "var(--fw-black)",
              fontVariantNumeric: "tabular-nums",
              color: TEXT_SECONDARY_STRONG,
            }}
          >
            {count}
          </span>
        </span>
      </PlacePhoto>
    </button>
  );
}

/** The end of the rail when more neighbourhoods are saved than it shows: an empty slot that opens the rest. */
export function AllAreasTile({ label, onClick }: { label: string; onClick: () => void }) {
  const press = usePressable<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        flex: "0 0 auto",
        width: ALL_W,
        height: TILE_H,
        padding: "0 var(--sp-5)",
        borderRadius: "var(--r-field)",
        border: `${DASH}px dashed var(--grey-300)`,
        textAlign: "center",
        fontFamily: "var(--font-display)",
        fontSize: "var(--fs-caption)",
        lineHeight: "var(--lh-caption)",
        fontWeight: "var(--fw-bold)",
        letterSpacing: "var(--tr-tight)",
        color: TEXT_SECONDARY_STRONG,
        ...press.style,
      }}
    >
      {label}
    </button>
  );
}

/** Mapbox's own wording and links; not translated. */
const CREDITS = [
  { label: "© Mapbox", href: "https://www.mapbox.com/about/maps" },
  { label: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
  { label: "Improve this map", href: "https://apps.mapbox.com/feedback/", strong: true },
];

/** The credit Mapbox requires near static maps, which do not carry their own. */
export function MapCredit() {
  return (
    <p
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--sp-3)",
        margin: 0,
        fontFamily: "var(--font-text)",
        fontSize: "var(--fs-nano)",
        lineHeight: "var(--lh-nano)",
        color: TEXT_SECONDARY_STRONG,
      }}
    >
      {CREDITS.map(({ label, href, strong }) => (
        <a key={href} href={href} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none", fontWeight: strong ? "var(--fw-bold)" : undefined }}>
          {label}
        </a>
      ))}
    </p>
  );
}
