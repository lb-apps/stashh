"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LayoutGrid, List, Navigation, SlidersHorizontal, UserRound, type LucideIcon } from "lucide-react";
import { track } from "@/lib/analytics/analytics";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { ScopePill } from "@/lib/discovery/components/ScopePill";
import { ScreenHeader, useScreenScroll } from "@/lib/discovery/components/Screen";
import { motionToken } from "@/lib/discovery/token-values";
import { useElementSize } from "@/lib/discovery/use-element-size";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePosition } from "@/lib/platform/location";
import { formatCount } from "@/lib/stashh/format";
import { useLists, usePlaces } from "@/lib/stashh/queries";
import { countBy, foldForSearch, isFiltered, neighbourhoods, newestFirst, sortNearYou } from "@/lib/stashh/selectors";
import type { CategoryGroup, SavedPlace } from "@/lib/stashh/types";
import { EmptyLibrary } from "../library/empty-library";
import { PlaceTile } from "../places/place-tile";
import { QuietNote, SheetBody } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { useVisiblePlaces } from "../shell/use-visible-places";
import { homeCopy } from "./copy";
import { AreaRail, PlaceCardRail, TypeRows } from "./home-rails";
import { HomeSection } from "./home-section";
import { CircleButton } from "./home-tiles";
import { MoreListsRow, SavedListRow, useOpenList } from "./list-stack-row";
import { LocationPrompt } from "./location-prompt";
import { NearbyMap } from "./nearby-map";
import { Rail } from "./rail";
import { SearchResults } from "./search-results";
import { TabSearch } from "./tab-search";

/** How many tiles the newest-saves rail carries; the section header opens the rest. */
const SAVED_LIMIT = 8;
/** Lists drawn as stacks under All; the Lists tab has them all. */
const LIST_LIMIT = 3;
/** Neighbourhoods on their rail, the most saved first; the section header opens the rest. */
const AREA_LIMIT = 5;
/** Tab pill glyph size in px. */
const TAB_GLYPH = 17;
/** How far a tab's body slides in from the side its tab lies on, in px. */
const TAB_SHIFT = 32;

export type HomeTab = "all" | "nearby" | "lists";

/** In order, left to right. */
const TABS: ReadonlyArray<{ id: HomeTab; icon: LucideIcon }> = [
  { id: "all", icon: LayoutGrid },
  { id: "nearby", icon: Navigation },
  { id: "lists", icon: List },
];

/**
 * The home screen. Its top is the app's bar: the All · Nearby · Lists tabs and
 * the profile, which swap the body below in place. All and Lists open with a
 * search field that sticks under the bar. Nothing saved yet: the paste invitation.
 */
export function HomeSheet() {
  const places = usePlaces().data;
  const scrollToTop = useScreenScroll();
  const [barRef, bar] = useElementSize<HTMLDivElement>();
  const [view, setView] = React.useState<{ tab: HomeTab; direction: 1 | -1 }>({ tab: "all", direction: 1 });

  if (places?.length === 0) {
    return (
      <>
        <ScreenHeader>{null}</ScreenHeader>
        <EmptyLibrary />
      </>
    );
  }

  const order = (tab: HomeTab) => TABS.findIndex((t) => t.id === tab);
  const showTab = (tab: HomeTab) => {
    if (tab === view.tab) return;
    setView({ tab, direction: order(tab) > order(view.tab) ? 1 : -1 });
    scrollToTop();
  };

  return (
    <>
      <ScreenHeader>
        <div ref={barRef}>
          <TabBar tab={view.tab} onTab={showTab} />
        </div>
      </ScreenHeader>
      {places ? <TabBody view={view} all={places} onTab={showTab} stickyTop={bar?.height ?? 0} /> : null}
    </>
  );
}

/** The tabs, and the profile at the end of the row. */
function TabBar({ tab, onTab }: { tab: HomeTab; onTab: (tab: HomeTab) => void }) {
  const copy = useCopy(homeCopy);
  const { open } = useSheetNav();
  return (
    <div>
      <Rail role="tablist" aria-label={copy.tabsLabel} gap="var(--sp-4)" paddingBottom="var(--sp-4)">
        {TABS.map(({ id, icon }) => (
          <ScopePill
            key={id}
            role="tab"
            aria-selected={tab === id}
            aria-pressed={undefined}
            active={tab === id}
            icon={<Glyph icon={icon} size={TAB_GLYPH} />}
            onClick={() => onTab(id)}
          >
            {copy.tabs[id]}
          </ScopePill>
        ))}
        {/* The last item of the row, scrolling with the tabs. */}
        <CircleButton icon={UserRound} label={copy.profile} onClick={() => open({ name: "profile" })} />
      </Rail>
    </div>
  );
}

/** The active tab's body, sliding in from the side its tab lies on (a fade alone with reduced motion). */
function TabBody({
  view,
  all,
  onTab,
  stickyTop,
}: {
  view: { tab: HomeTab; direction: 1 | -1 };
  all: SavedPlace[];
  onTab: (tab: HomeTab) => void;
  /** Where a tab's search field sticks: just under the bar, in px. */
  stickyTop: number;
}) {
  const copy = useCopy(homeCopy);
  const shift = useReducedMotion() ? 0 : TAB_SHIFT;
  const { duration, ease } = motionToken("--dur", "--ease-out");

  return (
    // Clipped, not hidden: the sliding body must not scroll the screen sideways, and sticky stays sticky.
    <div style={{ overflowX: "clip" }}>
      <AnimatePresence initial={false} mode="wait" custom={view.direction}>
        <motion.div
          key={view.tab}
          role="tabpanel"
          aria-label={copy.tabs[view.tab]}
          custom={view.direction}
          variants={{
            enter: (direction: number) => ({ x: direction * shift, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (direction: number) => ({ x: -direction * shift, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration, ease }}
        >
          {view.tab === "all" ? (
            <AllTab all={all} onTab={onTab} stickyTop={stickyTop} />
          ) : view.tab === "nearby" ? (
            <NearbyTab />
          ) : (
            <ListsTab all={all} stickyTop={stickyTop} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * All: a search across everything, then newest saves, lists, types and
 * neighbourhoods. Typing replaces the sections with results grouped by kind;
 * a type or neighbourhood fills the search.
 */
function AllTab({ all, onTab, stickyTop }: { all: SavedPlace[]; onTab: (tab: HomeTab) => void; stickyTop: number }) {
  const t = useT();
  const copy = useCopy(homeCopy);
  const locale = useIntlLocale();
  const { state, open } = useSheetNav();
  const scrollToTop = useScreenScroll();
  const openList = useOpenList();
  const { places: visible } = useVisiblePlaces();
  const lists = useLists().data ?? [];
  const [query, setQuery] = React.useState("");
  const filtered = isFiltered(state.filters);
  const onSearch = (next: string) => {
    setQuery(next);
    scrollToTop();
  };

  const saved = React.useMemo(() => newestFirst(visible).slice(0, SAVED_LIMIT), [visible]);
  const categories = React.useMemo(() => countBy<CategoryGroup>(all, (p) => p.category_group), [all]);
  const areas = React.useMemo(() => neighbourhoods(all), [all]);

  const n = (count: number) => formatCount(count, locale);
  const openPlace = (place: SavedPlace) => {
    track("place_viewed", { entry: "home" });
    open({ name: "place", placeId: place.id });
  };
  const openLibrary = () => open({ name: "library" });
  const moreLists = lists.length - LIST_LIMIT;

  const search = (
    <TabSearch
      top={stickyTop}
      value={query}
      onChange={setQuery}
      placeholder={copy.searchPlaceholder}
      label={copy.search}
      clearLabel={copy.clearSearch}
      trailing={<CircleButton plain icon={SlidersHorizontal} label={filtered ? copy.filterActive : copy.filter} dot={filtered} onClick={() => open({ name: "filter" })} />}
    />
  );
  if (query.trim()) {
    return (
      <>
        {search}
        <SearchResults all={all} query={query} onSearch={onSearch} />
      </>
    );
  }

  return (
    <>
      {search}
      <SheetBody gap="var(--sp-11)">
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
          <HomeSection title={copy.yourLists} meta={copy.lists(n(lists.length), lists.length)} onMore={() => onTab("lists")}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
              {lists.slice(0, LIST_LIMIT).map((list) => (
                <SavedListRow key={list.id} list={list} all={all} onOpen={openList} />
              ))}
              {moreLists > 0 ? <MoreListsRow count={`+${n(moreLists)}`} label={copy.moreLists(n(moreLists), moreLists)} onOpen={() => onTab("lists")} /> : null}
            </div>
          </HomeSection>
        ) : null}

        <HomeSection title={copy.types}>
          <TypeRows types={categories} onPick={(type) => onSearch(t.categories[type])} />
        </HomeSection>

        {areas.length ? (
          <HomeSection title={copy.neighbourhoods} meta={copy.areas(n(areas.length), areas.length)} onMore={openLibrary}>
            <AreaRail
              areas={areas.slice(0, AREA_LIMIT)}
              onOpen={(area) => onSearch(area.name)}
              more={areas.length > AREA_LIMIT ? { label: copy.allAreas, onClick: openLibrary } : undefined}
            />
          </HomeSection>
        ) : null}
      </SheetBody>
    </>
  );
}

/**
 * Nearby: the live map with every place on it, then the "Near you" section —
 * every place as a card, nearest first; without a position, the button that asks for it.
 */
function NearbyTab() {
  const copy = useCopy(homeCopy);
  const locale = useIntlLocale();
  const origin = usePosition();
  const { open } = useSheetNav();
  const { places: visible } = useVisiblePlaces();
  const nearYou = React.useMemo(() => sortNearYou(visible, origin), [visible, origin]);
  const openPlace = (place: SavedPlace) => {
    track("place_viewed", { entry: "home" });
    open({ name: "place", placeId: place.id });
  };
  return (
    <SheetBody>
      <NearbyMap places={visible} />
      <HomeSection title={copy.nearYou} meta={copy.spots(formatCount(nearYou.length, locale), nearYou.length)}>
        {origin ? null : <LocationPrompt />}
        {nearYou.length ? <PlaceCardRail places={nearYou} onOpen={openPlace} /> : <QuietNote>{copy.nothingMatches}</QuietNote>}
      </HomeSection>
    </SheetBody>
  );
}

/** Lists: a search across the lists — their names and the places in them — then every list as a stack. */
function ListsTab({ all, stickyTop }: { all: SavedPlace[]; stickyTop: number }) {
  const copy = useCopy(homeCopy);
  const openList = useOpenList();
  const lists = useLists().data;
  const [query, setQuery] = React.useState("");
  const q = foldForSearch(query.trim());

  const shown = React.useMemo(() => {
    if (!q) return lists ?? [];
    const hit = (text: string) => foldForSearch(text).includes(q);
    return (lists ?? []).filter((list) => hit(list.title) || all.some((p) => p.list_ids.includes(list.id) && hit(p.name)));
  }, [lists, all, q]);

  return (
    <>
      <TabSearch top={stickyTop} value={query} onChange={setQuery} placeholder={copy.searchLists} label={copy.searchLists} clearLabel={copy.clearSearch} />
      <SheetBody gap="var(--sp-7)">
        {lists?.length === 0 ? <QuietNote>{copy.noLists}</QuietNote> : null}
        {q && lists?.length && !shown.length ? <QuietNote>{copy.noListResults}</QuietNote> : null}
        {shown.map((list) => (
          <SavedListRow key={list.id} list={list} all={all} onOpen={openList} />
        ))}
      </SheetBody>
    </>
  );
}

