"use client";

import * as React from "react";
import { CategoryPill } from "@/lib/discovery/components/CategoryPill";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { formatCount } from "@/lib/stashh/format";
import type { Area } from "@/lib/stashh/selectors";
import type { CategoryGroup, SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { PlaceCard } from "../places/place-card";
import { homeCopy } from "./copy";
import { AllAreasTile, MapCredit, NeighbourhoodTile } from "./neighbourhood-tile";
import { Rail } from "./rail";

/**
 * The rails home's sections are drawn with — shared by the All tab and the
 * search results, so a group of places, types or areas looks the same in both.
 */

/** Places as photo cards, in the order given (nearest first on home). */
export function PlaceCardRail({ places, onOpen }: { places: SavedPlace[]; onOpen: (place: SavedPlace) => void }) {
  return (
    <Rail>
      {places.map((place) => (
        <PlaceCard key={place.id} place={place} onOpen={onOpen} />
      ))}
    </Rail>
  );
}

/** Type pills in two rows scrolled together; the first row takes the odd one. */
export function TypeRows({ types, onPick }: { types: Array<{ key: CategoryGroup; count: number }>; onPick: (type: CategoryGroup) => void }) {
  const t = useT();
  const locale = useIntlLocale();
  const half = Math.ceil(types.length / 2);
  const rows = [types.slice(0, half), types.slice(half)].filter((row) => row.length);
  return (
    <Rail paddingBottom="var(--sp-2)">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        {rows.map((row) => (
          <div key={row[0].key} style={{ display: "flex", gap: "var(--sp-5)" }}>
            {row.map(({ key, count }) => (
              <CategoryPill
                key={key}
                category={key}
                icon={CATEGORY_GLYPH[key]}
                label={t.categories[key]}
                count={formatCount(count, locale)}
                onClick={() => onPick(key)}
              />
            ))}
          </div>
        ))}
      </div>
    </Rail>
  );
}

/**
 * Areas as small maps, the largest first and wider, with an optional slot at
 * the end that opens the rest. Mapbox's credit goes under the last map rail on a screen.
 */
export function AreaRail({
  areas,
  zoom,
  onOpen,
  more,
  credit = true,
}: {
  areas: Area[];
  zoom?: number;
  onOpen: (area: Area) => void;
  more?: { label: string; onClick: () => void };
  credit?: boolean;
}) {
  const copy = useCopy(homeCopy);
  const locale = useIntlLocale();
  const n = (count: number) => formatCount(count, locale);
  return (
    <>
      <Rail paddingBottom="var(--sp-5)">
        {areas.map((area, index) => (
          <NeighbourhoodTile
            key={area.name}
            area={area}
            lead={index === 0}
            zoom={zoom}
            count={n(area.count)}
            label={`${area.name}, ${copy.spots(n(area.count), area.count)}`}
            onOpen={onOpen}
          />
        ))}
        {more ? <AllAreasTile label={more.label} onClick={more.onClick} /> : null}
      </Rail>
      {credit ? <MapCredit /> : null}
    </>
  );
}
