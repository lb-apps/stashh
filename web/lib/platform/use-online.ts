"use client";

import * as React from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser believes it has a connection (assumed online on the server). */
export function useOnline(): boolean {
  return React.useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
