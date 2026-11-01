"use client";

import * as React from "react";
import type { LatLng } from "../stashh/types";

/**
 * The reader's location, asked for only when they tap something that needs it
 * ("near me", recenter) — never on load. In-app browsers stack the host app's
 * permission on the site's and sometimes never answer, so a timeout counts as
 * a denial and the app carries on without a position.
 */
export type LocationState =
  | { status: "unknown" }
  | { status: "locating" }
  | { status: "granted"; position: LatLng }
  | { status: "denied" };

interface LocationContextValue {
  state: LocationState;
  /** Resolves with the position, or null when denied / timed out / unsupported. */
  locate: () => Promise<LatLng | null>;
}

const LocationContext = React.createContext<LocationContextValue | null>(null);

const TIMEOUT_MS = 8000;

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<LocationState>({ status: "unknown" });

  const locate = React.useCallback(
    () =>
      new Promise<LatLng | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setState({ status: "denied" });
          resolve(null);
          return;
        }
        setState((prev) => (prev.status === "granted" ? prev : { status: "locating" }));
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            const position = { latitude: coords.latitude, longitude: coords.longitude };
            setState({ status: "granted", position });
            resolve(position);
          },
          () => {
            setState({ status: "denied" });
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60_000 },
        );
      }),
    [],
  );

  const value = React.useMemo(() => ({ state, locate }), [state, locate]);
  return <LocationContext value={value}>{children}</LocationContext>;
}

export function useLocation(): LocationContextValue {
  const value = React.use(LocationContext);
  if (!value) throw new Error("useLocation() must be used inside <LocationProvider>");
  return value;
}

/** The position when known, otherwise null. */
export function usePosition(): LatLng | null {
  const { state } = useLocation();
  return state.status === "granted" ? state.position : null;
}
