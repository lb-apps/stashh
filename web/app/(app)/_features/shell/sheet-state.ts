import type { Detent } from "@/lib/discovery";
import type { Scope } from "@/lib/stashh/selectors";

/**
 * Which sheet is up, and how high. One reducer for the whole app so only one
 * sheet exists at a time and every transition is a named action — the screen
 * flow of the design (home → paste → results → list picker → celebrate, pin →
 * place, …) reads straight off `reduce`.
 */
export type SheetRoute =
  | { name: "home" }
  | { name: "search" }
  | { name: "paste" }
  | { name: "recognizing"; recognitionId: string }
  | { name: "results"; recognitionId: string }
  | { name: "listpicker"; recognitionId: string; googlePlaceIds: string[] }
  | { name: "newlist"; recognitionId: string; googlePlaceIds: string[] }
  | { name: "place"; placeId: string }
  | { name: "library" }
  | { name: "listdetail"; listId: string }
  | { name: "filter" }
  | { name: "profile" };

export interface SheetState {
  route: SheetRoute;
  detent: Detent;
  scope: Scope;
  /** Library ids of places just saved — their pins drop in. */
  justSaved: string[];
}

export type SheetAction =
  | { type: "open"; route: SheetRoute; detent?: Detent }
  | { type: "home" }
  | { type: "detent"; detent: Detent }
  | { type: "scope"; scope: Scope }
  | { type: "saved"; placeIds: string[] }
  | { type: "celebrated" };

export const initialSheetState: SheetState = { route: { name: "home" }, detent: "peek", scope: "all", justSaved: [] };

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
    case "saved":
      return { ...state, route: { name: "home" }, detent: "peek", justSaved: action.placeIds };
    case "celebrated":
      return { ...state, justSaved: [] };
  }
}
