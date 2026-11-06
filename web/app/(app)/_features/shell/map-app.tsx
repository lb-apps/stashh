"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { track } from "@/lib/analytics/analytics";
import { DetentSheet } from "@/lib/discovery/components/DetentSheet";
import { GlassProvider } from "@/lib/discovery/glass";
import { useLiquidGlass } from "@/lib/discovery/liquid-glass/use-liquid-glass";
import { useElementSize } from "@/lib/discovery/use-element-size";
import { useLocation } from "@/lib/platform/location";
import { useOnline } from "@/lib/platform/use-online";
import { useT } from "@/lib/i18n/provider";
import { usePlaces } from "@/lib/stashh/queries";
import { isFiltered } from "@/lib/stashh/selectors";
import { FilterSheet } from "../filter/filter-sheet";
import { HomeSheet } from "../home/home-sheet";
import { LibrarySheet } from "../library/library-sheet";
import { ListDetailSheet } from "../lists/list-detail-sheet";
import type { MapHandle } from "../map/map-view";
import { PlaceSheet } from "../place/place-sheet";
import { ProfileSheet } from "../profile/profile-sheet";
import { Celebration } from "../recognize/celebration";
import { ListPickerSheet } from "../recognize/list-picker-sheet";
import { NewListSheet } from "../recognize/new-list-sheet";
import { PasteSheet } from "../recognize/paste-sheet";
import { RecognizingSheet } from "../recognize/recognizing-sheet";
import { ResultsSheet } from "../recognize/results-sheet";
import { SearchSheet } from "../search/search-sheet";
import { MapControls, MapHeader, PasteFab } from "./map-chrome";
import { initialSheetState, reduceSheet, SheetNavProvider, useSheetNav, type SheetRoute } from "./sheet-state";
import { useVisiblePlaces } from "./use-visible-places";

// The map (and its WebGL code) loads after the shell has painted.
const MapView = dynamic(() => import("../map/map-view").then((m) => m.MapView), { ssr: false });

/** Home peek: 60% of the screen, never under 400px, never closer than 96px to the top. */
const homePeek = (h: number) => Math.min(Math.max(h * 0.6, 400), h - 96);
/** A place or a running read peeks lower, so the pin stays in view. */
const detailPeek = (h: number) => Math.min(Math.max(h * 0.42, 320), h - 96);

function peekFor(route: SheetRoute) {
  return route.name === "place" || route.name === "recognizing" ? detailPeek : homePeek;
}

/** One screen per route; every screen is composed from the shared parts. */
function SheetScreen({ route }: { route: SheetRoute }) {
  switch (route.name) {
    case "home":
      return <HomeSheet />;
    case "search":
      return <SearchSheet />;
    case "paste":
      return <PasteSheet />;
    case "recognizing":
      return <RecognizingSheet recognitionId={route.recognitionId} />;
    case "results":
      return <ResultsSheet recognitionId={route.recognitionId} />;
    case "listpicker":
      return <ListPickerSheet target={route.target} />;
    case "newlist":
      return <NewListSheet target={route.target} />;
    case "place":
      return <PlaceSheet key={route.placeId} placeId={route.placeId} />;
    case "library":
      return <LibrarySheet />;
    case "listdetail":
      return <ListDetailSheet key={route.listId} listId={route.listId} />;
    case "filter":
      return <FilterSheet />;
    case "profile":
      return <ProfileSheet />;
  }
}

/** The app: a live map, glass chrome floating on it, and one sheet at a time. */
export function MapApp() {
  const [state, dispatch] = React.useReducer(reduceSheet, initialSheetState);
  return (
    <SheetNavProvider state={state} dispatch={dispatch}>
      <MapScreen />
    </SheetNavProvider>
  );
}

function MapScreen() {
  const t = useT();
  const nav = useSheetNav();
  const { state } = nav;
  const all = usePlaces();
  const { places } = useVisiblePlaces();
  const location = useLocation();
  const online = useOnline();
  const { glass, registry, onBackdropReady, onBackdropLost } = useLiquidGlass();
  const [rootRef, root] = useElementSize<HTMLDivElement>();
  const mapRef = React.useRef<MapHandle>(null);
  // The drop animation ends before the celebration card does; pins hand over to the GL layer as they land.
  const [landed, setLanded] = React.useState<string[] | null>(null);

  const route = state.route;
  const selectedId = route.name === "place" ? route.placeId : null;
  const peek = peekFor(route);
  const bottomInset = root && state.detent === "peek" ? peek(root.height) : 0;

  // Whatever opened a place — a pin, a card, search — the map brings it into view.
  React.useEffect(() => {
    const place = selectedId ? all.data?.find((p) => p.id === selectedId) : undefined;
    if (place) mapRef.current?.focus(place);
  }, [selectedId, all.data]);

  const recenter = async () => {
    const position = location.state.status === "granted" ? location.state.position : await location.locate();
    if (position) mapRef.current?.centre(position);
  };

  return (
    <div ref={rootRef} style={{ position: "absolute", inset: 0 }}>
      <MapView
        ref={mapRef}
        places={places}
        selectedId={selectedId}
        onSelect={(placeId) => {
          if (!placeId) return nav.home();
          track("place_viewed", { entry: "map_pin" });
          nav.open({ name: "place", placeId });
        }}
        dropping={landed === state.justSaved ? [] : state.justSaved}
        onDropped={() => setLanded(state.justSaved)}
        bottomInset={bottomInset}
        userLocation={location.state.status === "granted" ? location.state.position : null}
        glass={glass}
        onGlassReady={onBackdropReady}
        onGlassLost={onBackdropLost}
        onUnavailable={onBackdropLost}
      />

      <GlassProvider value={registry}>
        <MapHeader
          places={all.data ?? []}
          online={online}
          filtered={isFiltered(state.filters)}
          onSearch={() => nav.open({ name: "search" })}
          onFilter={() => nav.open({ name: "filter" })}
          onProfile={() => nav.open({ name: "profile" })}
        />
        {state.detent === "peek" ? <MapControls denied={location.state.status === "denied"} onRecenter={recenter} /> : null}
      </GlassProvider>

      <DetentSheet
        aria-label="Stashh"
        detent={state.detent}
        onDetentChange={(detent) => nav.dispatch({ type: "detent", detent })}
        peekHeight={peek}
        onDismiss={route.name === "home" ? undefined : nav.home}
        closeLabel={t.common.close}
        onCoverChange={(px) => document.documentElement.style.setProperty("--sheet-cover", `${px}px`)}
      >
        <SheetScreen route={route} />
      </DetentSheet>

      {route.name === "home" ? <PasteFab onPaste={() => nav.open({ name: "paste" })} /> : null}

      {state.justSaved.length ? (
        <Celebration count={state.justSaved.length} listName={state.justSavedInto} onDone={() => nav.dispatch({ type: "celebrated" })} />
      ) : null}
    </div>
  );
}
