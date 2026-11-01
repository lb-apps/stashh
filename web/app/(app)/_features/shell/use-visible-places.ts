"use client";

import * as React from "react";
import { usePosition } from "@/lib/platform/location";
import { usePlaces } from "@/lib/stashh/queries";
import { applyFilters } from "@/lib/stashh/selectors";
import type { SavedPlace } from "@/lib/stashh/types";
import { useSheetNav } from "./sheet-state";

/** The library narrowed by the Filter sheet — what the map pins and the home lists show. */
export function useVisiblePlaces(): { places: SavedPlace[]; total: number; isLoading: boolean } {
  const { data, isLoading } = usePlaces();
  const { state } = useSheetNav();
  const origin = usePosition();
  const places = React.useMemo(() => applyFilters(data ?? [], state.filters, origin), [data, state.filters, origin]);
  return { places, total: data?.length ?? 0, isLoading };
}
