"use client";

import * as React from "react";
import { NO_FILTERS, type PlaceFilters } from "@/lib/stashh/selectors";

/** What a list picker / new list files: one saved place, or nothing yet. */
export type ListTarget = { kind: "place"; placeId: string } | { kind: "empty" };

/** A screen presented over home or over another presented screen. */
export type SheetRoute =
  | { name: "listpicker"; target: ListTarget }
  | { name: "newlist"; target: ListTarget }
  | { name: "place"; placeId: string }
  | { name: "library" }
  | { name: "listdetail"; listId: string }
  | { name: "filter" }
  | { name: "profile" };

/** One presented screen. The id tells it apart from a screen presented later at the same depth. */
export interface Presented {
  id: number;
  route: SheetRoute;
}

/**
 * Which screens are up. Home is always underneath; every other screen is
 * presented over the one on top, as an iOS sheet, and closing it uncovers the
 * screen it came from. One reducer for the whole app, so every transition is a
 * named action that reads straight off `reduceSheet`.
 */
export interface SheetState {
  /** Presented screens, bottom to top. Empty: home. */
  stack: Presented[];
  nextId: number;
  /** Narrow the places home shows (Filter screen). */
  filters: PlaceFilters;
}

export type SheetAction =
  | { type: "present"; route: SheetRoute }
  /** Closes the screen at `depth` and everything presented over it. */
  | { type: "close"; depth: number }
  | { type: "filters"; filters: PlaceFilters };

export const initialSheetState: SheetState = { stack: [], nextId: 0, filters: NO_FILTERS };

const sameRoute = (a: SheetRoute | undefined, b: SheetRoute) => JSON.stringify(a) === JSON.stringify(b);

export function reduceSheet(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case "present":
      // A second tap on what is already on top presents nothing new.
      if (sameRoute(state.stack.at(-1)?.route, action.route)) return state;
      return { ...state, stack: [...state.stack, { id: state.nextId, route: action.route }], nextId: state.nextId + 1 };
    case "close":
      return { ...state, stack: state.stack.slice(0, Math.max(0, action.depth)) };
    case "filters":
      return { ...state, filters: action.filters };
  }
}

interface SheetNav {
  state: SheetState;
  /** Presents a screen over the one on top. */
  open: (route: SheetRoute) => void;
  /** Closes the screen at `depth` and everything presented over it. */
  close: (depth: number) => void;
  setFilters: (filters: PlaceFilters) => void;
}

const SheetNavContext = React.createContext<SheetNav | null>(null);
const DepthContext = React.createContext<number | null>(null);

/** Screens navigate through this — never by holding the reducer themselves. */
export function SheetNavProvider({ state, dispatch, children }: { state: SheetState; dispatch: React.Dispatch<SheetAction>; children: React.ReactNode }) {
  const nav = React.useMemo<SheetNav>(
    () => ({
      state,
      open: (route) => dispatch({ type: "present", route }),
      close: (depth) => dispatch({ type: "close", depth }),
      setFilters: (filters) => dispatch({ type: "filters", filters }),
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

/** Tells a presented screen where it stands in the stack, so it can close itself. */
export function PresentedAt({ depth, children }: { depth: number; children: React.ReactNode }) {
  return <DepthContext value={depth}>{children}</DepthContext>;
}

/**
 * Closes the screen it is called from, uncovering the one under it. With
 * `alsoBelow`, that many of the screens it was presented over close too — a new
 * list made from the list picker closes the picker with it.
 */
export function useCloseScreen(): (alsoBelow?: number) => void {
  const depth = React.use(DepthContext);
  const { close } = useSheetNav();
  if (depth == null) throw new Error("useCloseScreen() must be used inside a presented screen");
  return React.useCallback((alsoBelow = 0) => close(depth - alsoBelow), [close, depth]);
}
