"use client";

import * as React from "react";
import type { Detent } from "@/lib/discovery";
import { NO_FILTERS, type PlaceFilters, type Scope } from "@/lib/stashh/selectors";

/**
 * Which sheet is up, and how high. One reducer for the whole app so only one
 * sheet exists at a time and every transition is a named action — the screen
 * flow of the design (home → paste → results → list picker → celebrate, pin →
 * place, …) reads straight off `reduce`.
 */
/** What a list picker / new list files: recognised places, one saved place, or nothing yet. */
export type ListTarget =
  | { kind: "recognition"; recognitionId: string; resultId: string; googlePlaceIds: string[] }
  | { kind: "place"; placeId: string }
  | { kind: "empty" };

export type SheetRoute =
  | { name: "home" }
  | { name: "search" }
  | { name: "paste" }
  | { name: "recognizing"; recognitionId: string }
  | { name: "results"; recognitionId: string }
  | { name: "listpicker"; target: ListTarget }
  | { name: "newlist"; target: ListTarget }
  | { name: "place"; placeId: string }
  | { name: "library" }
  | { name: "listdetail"; listId: string }
  | { name: "filter" }
  | { name: "profile" };

export interface SheetState {
  route: SheetRoute;
  detent: Detent;
  scope: Scope;
  /** Narrow the map and lists (Filter sheet). */
  filters: PlaceFilters;
  /** Library ids of places just saved — their pins drop in. */
  justSaved: string[];
  /** The list they were filed into, for the celebration. */
  justSavedInto: string | null;
}

export type SheetAction =
  | { type: "open"; route: SheetRoute; detent?: Detent }
  | { type: "home" }
  | { type: "detent"; detent: Detent }
  | { type: "scope"; scope: Scope }
  | { type: "filters"; filters: PlaceFilters }
  | { type: "saved"; placeIds: string[]; listName: string | null }
  | { type: "celebrated" };

export const initialSheetState: SheetState = { route: { name: "home" }, detent: "peek", scope: "all", filters: NO_FILTERS, justSaved: [], justSavedInto: null };

/** Pin taps and the recognition progress peek over the map; everything else opens full. */
function defaultDetent(route: SheetRoute): Detent {
  return route.name === "place" || route.name === "home" || route.name === "recognizing" ? "peek" : "full";
}

export function reduceSheet(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case "open":
      return { ...state, route: action.route, detent: action.detent ?? defaultDetent(action.route) };
    case "home":
      return { ...state, route: { name: "home" }, detent: "peek" };
    case "detent":
      return { ...state, detent: action.detent };
    case "scope":
      return { ...state, scope: action.scope };
    case "filters":
      return { ...state, filters: action.filters };
    case "saved":
      return { ...state, route: { name: "home" }, detent: "peek", justSaved: action.placeIds, justSavedInto: action.listName };
    case "celebrated":
      return { ...state, justSaved: [], justSavedInto: null };
  }
}

interface SheetNav {
  state: SheetState;
  /** Raw actions, for the shell (detent changes, end of the celebration). */
  dispatch: React.Dispatch<SheetAction>;
  open: (route: SheetRoute, detent?: Detent) => void;
  home: () => void;
  setScope: (scope: Scope) => void;
  setFilters: (filters: PlaceFilters) => void;
  /** After saving recognised places: back to the map, pins drop in. */
  saved: (placeIds: string[], listName: string | null) => void;
}

const SheetNavContext = React.createContext<SheetNav | null>(null);

/** Sheets navigate through this — never by holding the reducer themselves. */
export function SheetNavProvider({ state, dispatch, children }: { state: SheetState; dispatch: React.Dispatch<SheetAction>; children: React.ReactNode }) {
  const nav = React.useMemo<SheetNav>(
    () => ({
      state,
      dispatch,
      open: (route, detent) => dispatch({ type: "open", route, detent }),
      home: () => dispatch({ type: "home" }),
      setScope: (scope) => dispatch({ type: "scope", scope }),
      setFilters: (filters) => dispatch({ type: "filters", filters }),
      saved: (placeIds, listName) => dispatch({ type: "saved", placeIds, listName }),
    }),
    [state, dispatch],
  );
  return <SheetNavContext value={nav}>{children}</SheetNavContext>;
}

export function useSheetNav(): SheetNav {
  const nav = React.use(SheetNavContext);
  if (!nav) throw new Error("useSheetNav() must be used inside <SheetNavProvider>");
  return nav;
}
