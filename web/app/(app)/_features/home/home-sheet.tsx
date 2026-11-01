"use client";

import * as React from "react";
import { CircleCheck, Clock, Flag, LayoutGrid, Map as MapGlyph, type LucideIcon } from "lucide-react";
import { CategoryPill } from "@/lib/discovery/components/CategoryPill";
import { SheetHeader } from "@/lib/discovery/components/DetentSheet";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { ListTile } from "@/lib/discovery/components/ListTile";
import { ScopePill } from "@/lib/discovery/components/ScopePill";
import { SectionHeader } from "@/lib/discovery/components/SectionHeader";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePosition } from "@/lib/platform/location";
import { formatCount } from "@/lib/stashh/format";
import { useLists, usePlaces, useRecentRecognitions } from "@/lib/stashh/queries";
import { applyScope, countBy, newestFirst, sortNearYou, type Scope } from "@/lib/stashh/selectors";
import type { CategoryGroup, RecentRecognition, SavedPlace } from "@/lib/stashh/types";
import { EmptyLibrary } from "../library/empty-library";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { PlaceCard } from "../places/place-card";
import { PlaceTile } from "../places/place-tile";
import { QuietNote, SheetBody } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { useVisiblePlaces } from "../shell/use-visible-places";
import { homeCopy } from "./copy";
import { NewListTile, SearchCircle } from "./home-tiles";
import { LocationPrompt } from "./location-prompt";
import { Rail } from "./rail";
import { ReelRow } from "./reel-row";

/** How many cards and tiles a rail carries; the section header opens the rest. */
const NEAR_LIMIT = 12;
const SAVED_LIMIT = 8;
/** Reels under "From your reels". */
const REEL_LIMIT = 3;
/** Scope pill glyph size in px. */
const SCOPE_GLYPH = 17;

const SCOPES: ReadonlyArray<{ id: Scope; icon: LucideIcon }> = [
  { id: "all", icon: LayoutGrid },
  { id: "open", icon: Clock },
  { id: "togo", icon: Flag },
  { id: "been", icon: CircleCheck },
];

const twoColumns: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--sp-6)" };

/**
 * The home sheet over the map: scope pills, the reader's spots and lists,
 * then sections to wander through — near you, newest saves, lists, types,
 * and the Reels still to sort. Nothing saved yet: the paste invitation.
 */
export function HomeSheet() {
  const places = usePlaces().data;

  if (places?.length === 0) {
    return (
      <>
        <SheetHeader>{null}</SheetHeader>
        <EmptyLibrary />
      </>
    );
  }
  return (
    <>
      <SheetHeader>
        <ScopeBar />
      </SheetHeader>
      {places ? <HomeContent all={places} /> : null}
    </>
  );
}

function ScopeBar() {
  const copy = useCopy(homeCopy);
  const { state, open, setScope } = useSheetNav();
  return (
    <Rail role="group" aria-label={copy.scopeGroup} paddingBottom="var(--sp-5)">
      <SearchCircle label={copy.search} onClick={() => open({ name: "search" })} />
      {SCOPES.map(({ id, icon }) => (
        <ScopePill key={id} active={state.scope === id} icon={<Glyph icon={icon} size={SCOPE_GLYPH} />} onClick={() => setScope(id)}>
          {copy.scopes[id]}
        </ScopePill>
      ))}
    </Rail>
  );
}

function HomeContent({ all }: { all: SavedPlace[] }) {
  const t = useT();
  const copy = useCopy(homeCopy);
  const locale = useIntlLocale();
  const origin = usePosition();
  const { state, open, setFilters } = useSheetNav();
  const { places: visible } = useVisiblePlaces();
  const lists = useLists().data ?? [];
  const reels = useRecentRecognitions().data ?? [];

  const nearYou = React.useMemo(() => sortNearYou(applyScope(visible, state.scope), origin), [visible, state.scope, origin]);
  const saved = React.useMemo(() => newestFirst(visible).slice(0, SAVED_LIMIT), [visible]);
  const categories = React.useMemo(() => countBy<CategoryGroup>(all, (p) => p.category_group), [all]);
  const openable = reels.filter(isOpenable).slice(0, REEL_LIMIT);

  const n = (count: number) => formatCount(count, locale);
  const openPlace = (place: SavedPlace) => open({ name: "place", placeId: place.id });
  const openLibrary = () => open({ name: "library" });
  const openReel = (reel: RecentRecognition) =>
    open(reel.status === "completed" ? { name: "results", recognitionId: reel.recognition_id } : { name: "recognizing", recognitionId: reel.recognition_id });
  const reelTitle = (reel: RecentRecognition) =>
    reel.author_username ? `@${reel.author_username}` : reel.source_type ? copy.source[reel.source_type] : copy.sharedLink;

  // Two rows of type pills, scrolled together; the first row takes the extra one.
  const half = Math.ceil(categories.length / 2);
  const categoryRows = [categories.slice(0, half), categories.slice(half)].filter((row) => row.length);

  return (
    <SheetBody>
      <div style={twoColumns}>
        <ListTile category="default" icon={MapGlyph} title={copy.mySpots} meta={copy.spots(n(all.length), all.length)} onClick={openLibrary} />
        <NewListTile label={copy.newList} onClick={() => open({ name: "newlist", target: { kind: "empty" } })} />
      </div>

      <HomeSection title={copy.nearYou} meta={copy.spots(n(nearYou.length), nearYou.length)} onMore={openLibrary}>
        {origin ? null : <LocationPrompt />}
        {nearYou.length ? (
          <Rail>
            {nearYou.slice(0, NEAR_LIMIT).map((place) => (
              <PlaceCard key={place.id} place={place} onOpen={openPlace} />
            ))}
          </Rail>
        ) : (
          <QuietNote>{copy.scopeEmpty[state.scope]}</QuietNote>
        )}
      </HomeSection>

      {saved.length ? (
        <HomeSection title={copy.savedSpots} meta={copy.spots(n(visible.length), visible.length)} onMore={openLibrary}>
          <Rail>
            {saved.map((place) => (
              <PlaceTile key={place.id} place={place} onOpen={openPlace} />
            ))}
          </Rail>
        </HomeSection>
      ) : null}

      {lists.length ? (
        <HomeSection title={copy.yourLists} meta={copy.lists(n(lists.length), lists.length)} onMore={openLibrary}>
          <div style={twoColumns}>
            {lists.map((list) => {
              const cover = list.cover_category ?? "default";
              return (
                <ListTile
                  key={list.id}
                  category={cover}
                  icon={CATEGORY_GLYPH[cover]}
                  title={list.title}
                  meta={copy.spots(n(list.place_count), list.place_count)}
                  onClick={() => open({ name: "listdetail", listId: list.id })}
                />
              );
            })}
          </div>
        </HomeSection>
      ) : null}

      <HomeSection title={copy.browseByType}>
        <Rail paddingBottom="var(--sp-2)">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
            {categoryRows.map((row) => (
              <div key={row[0].key} style={{ display: "flex", gap: "var(--sp-5)" }}>
                {row.map(({ key, count }) => (
                  <CategoryPill
                    key={key}
                    category={key}
                    icon={CATEGORY_GLYPH[key]}
                    label={t.categories[key]}
                    count={n(count)}
                    onClick={() => setFilters({ ...state.filters, category: key })}
                  />
                ))}
              </div>
            ))}
          </div>
        </Rail>
      </HomeSection>

      {openable.length ? (
        <HomeSection title={copy.fromReels}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
            {openable.map((reel) => (
              <ReelRow
                key={reel.recognition_id}
                reel={reel}
                title={reelTitle(reel)}
                meta={reel.status === "completed" ? copy.placesFound(n(reel.place_count), reel.place_count) : copy.reading}
                onOpen={openReel}
              />
            ))}
          </div>
        </HomeSection>
      ) : null}
    </SheetBody>
  );
}

/** A home section: the heavy title (a button to the library when `onMore` is set), its count, then the content. */
function HomeSection({ title, meta, onMore, children }: { title: string; meta?: string; onMore?: () => void; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <SectionHeader title={title} meta={meta} onClick={onMore} />
      {children}
    </section>
  );
}

/**
 * A Reel worth a row: still being read (opens the progress) or read with places
 * to sort (opens them). Saved, failed and empty ones have nothing to open.
 */
function isOpenable(reel: RecentRecognition): boolean {
  if (reel.status === "queued" || reel.status === "processing") return true;
  return reel.status === "completed" && reel.place_count > 0;
}
