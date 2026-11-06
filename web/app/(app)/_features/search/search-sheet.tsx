"use client";

import * as React from "react";
import { track } from "@/lib/analytics/analytics";
import { SheetHeader } from "@/lib/discovery/components/DetentSheet";
import { SearchField } from "@/lib/discovery/components/SearchField";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePosition } from "@/lib/platform/location";
import { formatCount } from "@/lib/stashh/format";
import { usePlaces } from "@/lib/stashh/queries";
import { newestFirst, searchPlaces, sortNearYou } from "@/lib/stashh/selectors";
import type { SavedPlace } from "@/lib/stashh/types";
import { PlaceRows, Section, SheetBody } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { searchCopy } from "./copy";

/** Places listed under "Recently saved" before anything is typed. */
const RECENT_LIMIT = 8;

/** Focuses the field once it is in the document, without scrolling the sliding sheet — a DOM sync, not state. */
function focusOnMount(node: HTMLInputElement | null) {
  node?.focus({ preventScroll: true });
}

/**
 * Search across the whole library by name, neighbourhood, city or category.
 * Nothing typed: the latest saves. Matches are nearest first when the reader's
 * position is known.
 */
export function SearchSheet() {
  const t = useT();
  const copy = useCopy(searchCopy);
  const locale = useIntlLocale();
  const origin = usePosition();
  const { open } = useSheetNav();
  const places = usePlaces().data;
  const [query, setQuery] = React.useState("");

  const searching = query.trim().length > 0;
  const results = React.useMemo(() => {
    if (!places) return [];
    if (!searching) return newestFirst(places).slice(0, RECENT_LIMIT);
    return sortNearYou(searchPlaces(places, query, (c) => t.categories[c]), origin);
  }, [places, searching, query, t, origin]);

  const openPlace = (place: SavedPlace) => {
    track("place_viewed", { entry: "search" });
    open({ name: "place", placeId: place.id });
  };

  return (
    <>
      <SheetHeader style={{ paddingBottom: "var(--sp-6)" }}>
        <div role="search" style={{ paddingTop: "var(--sp-2)" }}>
          <SearchField
            ref={focusOnMount}
            variant="filledOnWhite"
            value={query}
            placeholder={copy.placeholder}
            aria-label={t.common.search}
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            clearLabel={copy.clear}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
          />
        </div>
      </SheetHeader>
      {places ? (
        <SheetBody>
          {searching && results.length === 0 ? (
            <div role="status" style={{ padding: "var(--sp-10) 0 var(--sp-5)", textAlign: "center" }}>
              <p className="ds-title-2" style={{ margin: 0, fontWeight: "var(--fw-semibold)" }}>
                {copy.noResults}
              </p>
              <p className="ds-body-lg" style={{ margin: "var(--sp-3) 0 0", color: TEXT_SECONDARY_STRONG }}>
                {copy.noResultsHint}
              </p>
            </div>
          ) : results.length ? (
            <Section as="h2" label={searching ? copy.results(formatCount(results.length, locale), results.length) : copy.recentlySaved}>
              <PlaceRows places={results} onOpen={openPlace} />
            </Section>
          ) : null}
        </SheetBody>
      ) : null}
    </>
  );
}
