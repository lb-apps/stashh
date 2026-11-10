"use client";

import * as React from "react";
import { Button } from "@/lib/discovery/components/Button";
import { ScreenFooter } from "@/lib/discovery/components/Screen";
import { ScopePill } from "@/lib/discovery/components/ScopePill";
import { SegmentedControl } from "@/lib/discovery/components/SegmentedControl";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { useLocation, usePosition } from "@/lib/platform/location";
import { formatCount, formatDistance } from "@/lib/stashh/format";
import { useLists, usePlaces } from "@/lib/stashh/queries";
import { countBy, isFiltered, NO_FILTERS, type DistanceFilter, type PlaceFilters, type VisitFilter } from "@/lib/stashh/selectors";
import type { CategoryGroup } from "@/lib/stashh/types";
import { QuietNote, SectionLabel, SheetBody, SheetTitle } from "../shell/sheet-parts";
import { useCloseScreen, useSheetNav } from "../shell/sheet-state";
import { useVisiblePlaces } from "../shell/use-visible-places";
import { filterCopy } from "./copy";

const VISITS: readonly VisitFilter[] = ["all", "togo", "been"];
const DISTANCES: readonly DistanceFilter[] = ["any", 1000, 3000];

/**
 * Narrow the map and the home lists by list, category, visited and distance.
 * Every choice applies at once — the map behind updates live — and the footer
 * says how many places are left.
 */
export function FilterSheet() {
  const t = useT();
  const copy = useCopy(filterCopy);
  const locale = useIntlLocale();
  const { state, setFilters } = useSheetNav();
  const close = useCloseScreen();
  const { locate, state: location } = useLocation();
  const origin = usePosition();
  const lists = useLists().data ?? [];
  const categories = countBy<CategoryGroup>(usePlaces().data ?? [], (p) => p.category_group);
  const visible = useVisiblePlaces().places.length;
  const filters = state.filters;

  const set = (patch: Partial<PlaceFilters>) => setFilters({ ...filters, ...patch });

  // A distance needs the reader's position; ask for it on the tap that needs it.
  const pickDistance = async (distance: DistanceFilter) => {
    if (distance !== "any" && !origin && !(await locate())) return;
    set({ distance });
  };

  return (
    <>
      <SheetTitle
        title={copy.title}
        trailing={
          isFiltered(filters) ? (
            <Button variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
              {copy.clear}
            </Button>
          ) : null
        }
      />

      <SheetBody gap="var(--sp-9)">
        {lists.length ? (
          <FilterGroup heading={copy.list}>
            <Chips
              options={[{ value: "all", label: copy.allLists }, ...lists.map((l) => ({ value: l.id, label: l.title }))]}
              value={filters.listId}
              onChange={(listId) => set({ listId })}
            />
          </FilterGroup>
        ) : null}

        <FilterGroup heading={copy.category}>
          <Chips
            options={[{ value: "all" as const, label: copy.everything }, ...categories.map(({ key }) => ({ value: key, label: t.categories[key] }))]}
            value={filters.category}
            onChange={(category) => set({ category })}
          />
        </FilterGroup>

        <FilterGroup heading={copy.visited}>
          <SegmentedControl
            onWhite
            aria-label={copy.visited}
            options={VISITS.map((v) => ({ value: v, label: copy.visit[v] }))}
            value={filters.visit}
            onChange={(next) => set({ visit: VISITS.find((v) => v === next) ?? "all" })}
          />
        </FilterGroup>

        <FilterGroup heading={copy.distance}>
          <SegmentedControl
            onWhite
            aria-label={copy.distance}
            options={DISTANCES.map((d) => ({ value: String(d), label: d === "any" ? copy.anyDistance : copy.under(formatDistance(d, locale)) }))}
            value={String(filters.distance)}
            onChange={(next) => void pickDistance(DISTANCES.find((d) => String(d) === next) ?? "any")}
          />
          {location.status === "denied" ? (
            <div style={{ marginTop: "var(--sp-5)" }}>
              <QuietNote>{copy.locationOff}</QuietNote>
            </div>
          ) : null}
        </FilterGroup>
      </SheetBody>

      <ScreenFooter>
        <Button variant="primary" size="lg" shape="pill" fullWidth disabled={visible === 0} onClick={() => close()}>
          {visible === 0 ? copy.nothingMatches : copy.show(formatCount(visible, locale), visible)}
        </Button>
      </ScreenFooter>
    </>
  );
}

/** A labelled filter: the micro heading names the group of controls under it. */
function FilterGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section>
      <SectionLabel id={id}>{heading}</SectionLabel>
      <div role="group" aria-labelledby={id}>
        {children}
      </div>
    </section>
  );
}

/** One-of-many choice as wrapping pills; the chosen one is glossy cobalt. */
function Chips<V extends string>({ options, value, onChange }: { options: Array<{ value: V; label: string }>; value: V; onChange: (value: V) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-5)" }}>
      {options.map((o) => (
        <ScopePill key={o.value} active={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </ScopePill>
      ))}
    </div>
  );
}
