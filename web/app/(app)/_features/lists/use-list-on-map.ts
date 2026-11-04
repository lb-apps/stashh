"use client";

import * as React from "react";
import { NO_FILTERS, type PlaceFilters } from "@/lib/stashh/selectors";
import { useSheetNav } from "../shell/sheet-state";

/**
 * While a list is open, the map shows only that list. The filters in force
 * when the sheet opened come back when it closes, so the Filter sheet's
 * choices survive a visit to a list — also when the sheet moves from one list
 * to another without closing.
 */
export function useListOnMap(listId: string) {
  const { state, setFilters } = useSheetNav();
  /** The filters from before the first list was shown; null while nothing is held. */
  const held = React.useRef<PlaceFilters | null>(null);

  // Read when the list shows or the sheet closes, not as dependencies: the
  // filters change *because* of these effects, and `setFilters` changes
  // identity with every navigation.
  const show = React.useEffectEvent((id: string) => {
    held.current ??= state.filters;
    setFilters({ ...NO_FILTERS, listId: id });
  });
  const restore = React.useEffectEvent(() => {
    if (held.current) setFilters(held.current);
    held.current = null;
  });

  React.useEffect(() => show(listId), [listId]);
  React.useEffect(() => () => restore(), []);
}
