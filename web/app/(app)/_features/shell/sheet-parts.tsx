"use client";

import * as React from "react";
import { ScreenHeader } from "@/lib/discovery/components/Screen";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import type { SavedPlace } from "@/lib/stashh/types";
import { PlaceListRow } from "../places/place-row";

/**
 * The parts every sheet screen is built from, so a title, a section or a
 * stack of places is drawn one way everywhere: the pinned title header, the
 * scrolling body, the uppercase section label and the section it heads.
 */

/**
 * The screen's header with its title ("My places", "Filter"), an optional grey
 * line under it, and an optional control beside it. `children` go under the
 * title. In a sheet the navigation bar takes the title over once it scrolls away.
 */
export function SheetTitle({
  title,
  sub,
  trailing,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const heading = (
    <h2 className="ds-display-1" style={{ margin: "var(--sp-3) 0 0", textWrap: "balance" }}>
      {title}
    </h2>
  );
  return (
    <ScreenHeader navTitle={title} style={{ paddingBottom: "var(--sp-6)" }}>
      {trailing ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-6)" }}>
          {heading}
          {trailing}
        </div>
      ) : (
        heading
      )}
      {sub ? (
        <p className="ds-body-lg" style={{ margin: "var(--sp-4) 0 0", color: TEXT_SECONDARY_STRONG }}>
          {sub}
        </p>
      ) : null}
      {children}
    </ScreenHeader>
  );
}

/** The sheet's scrolling content: inset by the gutter, its blocks spaced by `gap`, clear of the footer's fade. */
export function SheetBody({ children, gap = "var(--sp-10)" }: { children: React.ReactNode; gap?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap, padding: "var(--sp-4) var(--gutter) var(--sp-12)" }}>{children}</div>
  );
}

/** An uppercase section label ("BY CATEGORY", "SETTINGS"). */
export function SectionLabel({ as = "h3", id, children }: { as?: "h2" | "h3"; id?: string; children: React.ReactNode }) {
  return (
    <MicroLabel as={as} id={id} style={{ margin: "0 0 var(--sp-5)" }}>
      {children}
    </MicroLabel>
  );
}

/** A labelled block of a sheet: its section label, then its content. */
export function Section({
  label,
  as,
  style,
  children,
}: {
  label: React.ReactNode;
  as?: "h2" | "h3";
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} style={style}>
      <SectionLabel as={as} id={id}>
        {label}
      </SectionLabel>
      {children}
    </section>
  );
}

/** Place rows stacked with the row gap. `trailing` puts a control at the end of each row. */
export function PlaceRows({
  places,
  onOpen,
  trailing,
}: {
  places: SavedPlace[];
  onOpen: (place: SavedPlace) => void;
  trailing?: (place: SavedPlace) => React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      {places.map((place) => (
        <PlaceListRow key={place.id} place={place} onOpen={onOpen} trailing={trailing?.(place)} />
      ))}
    </div>
  );
}

/** A line of grey helper text standing in for an empty section. */
export function QuietNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="ds-caption" style={{ margin: 0, color: TEXT_SECONDARY_STRONG }}>
      {children}
    </p>
  );
}
