"use client";

import * as React from "react";
import { track } from "@/lib/analytics/analytics";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePosition } from "@/lib/platform/location";
import { formatCount } from "@/lib/stashh/format";
import { useLists } from "@/lib/stashh/queries";
import { applyFilters, areasBy, countBy, foldForSearch, searchPlaces, sortNearYou } from "@/lib/stashh/selectors";
import type { CategoryGroup, SavedPlace } from "@/lib/stashh/types";
import { SheetBody } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { homeCopy } from "./copy";
import { AreaRail, PlaceCardRail, TypeRows } from "./home-rails";
import { HomeSection } from "./home-section";
import { SavedListRow, useOpenList } from "./list-stack-row";

/** A city fits its tile at this zoom; neighbourhoods keep the map's closer default. */
const CITY_ZOOM = 10;

/**
 * Search across everything on home, grouped by what matched — places, lists,
 * types, neighbourhoods, cities — each group only when it has a hit, and drawn
 * with the same rails as home's sections. Case and accents are folded
 * ("kadikoy" finds Kadıköy). Tapping a type, neighbourhood or city narrows the
 * search to its places.
 */
export function SearchResults({ all, query, onSearch }: { all: SavedPlace[]; query: string; onSearch: (query: string) => void }) {
  const t = useT();
  const copy = useCopy(homeCopy);
  const locale = useIntlLocale();
  const origin = usePosition();
  const { state, open } = useSheetNav();
  const lists = useLists().data;
  const openList = useOpenList();

  const groups = React.useMemo(() => {
    const q = foldForSearch(query.trim());
    const hit = (text: string) => foldForSearch(text).includes(q);
    return {
      places: sortNearYou(searchPlaces(applyFilters(all, state.filters, origin), query, (c) => t.categories[c]), origin),
      lists: (lists ?? []).filter((list) => hit(list.title)),
      types: countBy<CategoryGroup>(all, (p) => p.category_group).filter(({ key }) => hit(t.categories[key])),
      areas: areasBy(all, (p) => p.district).filter((area) => hit(area.name)),
      cities: areasBy(all, (p) => p.city).filter((area) => hit(area.name)),
    };
  }, [all, query, state.filters, origin, lists, t]);

  const n = (count: number) => formatCount(count, locale);
  const openPlace = (place: SavedPlace) => {
    track("place_viewed", { entry: "search" });
    open({ name: "place", placeId: place.id });
  };

  const found = groups.places.length + groups.lists.length + groups.types.length + groups.areas.length + groups.cities.length;
  if (!found) {
    return (
      <div role="status" style={{ padding: "var(--sp-10) var(--gutter) var(--sp-5)", textAlign: "center" }}>
        <p className="ds-title-2" style={{ margin: 0, fontWeight: "var(--fw-semibold)" }}>
          {copy.noResults}
        </p>
        <p className="ds-body-lg" style={{ margin: "var(--sp-3) 0 0", color: TEXT_SECONDARY_STRONG }}>
          {copy.noResultsHint}
        </p>
      </div>
    );
  }

  return (
    <SheetBody>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-11)" }}>
        {groups.places.length ? (
          <HomeSection title={copy.groups.places} meta={copy.spots(n(groups.places.length), groups.places.length)}>
            <PlaceCardRail places={groups.places} onOpen={openPlace} />
          </HomeSection>
        ) : null}

        {groups.lists.length ? (
          <HomeSection title={copy.groups.lists} meta={copy.lists(n(groups.lists.length), groups.lists.length)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
              {groups.lists.map((list) => (
                <SavedListRow key={list.id} list={list} all={all} onOpen={openList} />
              ))}
            </div>
          </HomeSection>
        ) : null}

        {groups.types.length ? (
          <HomeSection title={copy.groups.types}>
            <TypeRows types={groups.types} onPick={(type) => onSearch(t.categories[type])} />
          </HomeSection>
        ) : null}

        {groups.areas.length ? (
          <HomeSection title={copy.groups.areas} meta={copy.areas(n(groups.areas.length), groups.areas.length)}>
            <AreaRail areas={groups.areas} onOpen={(area) => onSearch(area.name)} credit={!groups.cities.length} />
          </HomeSection>
        ) : null}

        {groups.cities.length ? (
          <HomeSection title={copy.groups.cities} meta={copy.cities(n(groups.cities.length), groups.cities.length)}>
            <AreaRail areas={groups.cities} zoom={CITY_ZOOM} onOpen={(area) => onSearch(area.name)} />
          </HomeSection>
        ) : null}
      </div>
    </SheetBody>
  );
}
