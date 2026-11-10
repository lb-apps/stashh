"use client";

import * as React from "react";
import { AnimatePresence } from "motion/react";
import { PageSheet, PresentingLayer } from "@/lib/discovery/components/PageSheet";
import { Screen } from "@/lib/discovery/components/Screen";
import { useCopy, useT } from "@/lib/i18n/provider";
import { FilterSheet } from "../filter/filter-sheet";
import { HomeSheet } from "../home/home-sheet";
import { LibrarySheet } from "../library/library-sheet";
import { ListDetailSheet } from "../lists/list-detail-sheet";
import { PlaceSheet } from "../place/place-sheet";
import { ProfileSheet } from "../profile/profile-sheet";
import { ListPickerSheet } from "../recognize/list-picker-sheet";
import { NewListSheet } from "../recognize/new-list-sheet";
import { shellCopy } from "./copy";
import { CreateFab, CreateSheet } from "./create-sheet";
import { initialSheetState, PresentedAt, reduceSheet, SheetNavProvider, useSheetNav, type SheetRoute } from "./sheet-state";

/** One screen per route; every screen is composed from the shared parts. */
function RouteScreen({ route }: { route: SheetRoute }) {
  switch (route.name) {
    case "listpicker":
      return <ListPickerSheet target={route.target} />;
    case "newlist":
      return <NewListSheet target={route.target} />;
    case "place":
      return <PlaceSheet placeId={route.placeId} />;
    case "library":
      return <LibrarySheet />;
    case "listdetail":
      return <ListDetailSheet listId={route.listId} />;
    case "filter":
      return <FilterSheet />;
    case "profile":
      return <ProfileSheet />;
  }
}

/**
 * The app: home as a full-page screen, and every other screen presented over
 * the current one as a page sheet — a place over a list, a list picker over
 * the place. Closing a sheet uncovers the screen it came from, which kept its
 * scroll. The + button on home asks what to create.
 */
export function MapApp() {
  const [state, dispatch] = React.useReducer(reduceSheet, initialSheetState);
  return (
    <SheetNavProvider state={state} dispatch={dispatch}>
      <AppScreens />
    </SheetNavProvider>
  );
}

function AppScreens() {
  const t = useT();
  const c = useCopy(shellCopy);
  const nav = useSheetNav();
  const { stack } = nav.state;
  const [creating, setCreating] = React.useState(false);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "var(--ink)" }}>
      <PresentingLayer covered={stack.length > 0}>
        <Screen aria-label="Stashh">
          <HomeSheet />
        </Screen>
        <CreateFab onCreate={() => setCreating(true)} />
      </PresentingLayer>

      <AnimatePresence>
        {stack.map(({ id, route }, depth) => (
          <PageSheet
            key={id}
            covered={depth < stack.length - 1}
            onClose={() => nav.close(depth)}
            closeLabel={t.common.close}
            aria-label={route.name === "profile" ? c.profile : "Stashh"}
          >
            <PresentedAt depth={depth}>
              <RouteScreen route={route} />
            </PresentedAt>
          </PageSheet>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {creating ? (
          <CreateSheet
            onClose={() => setCreating(false)}
            onList={() => {
              setCreating(false);
              nav.open({ name: "newlist", target: { kind: "empty" } });
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
