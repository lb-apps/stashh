"use client";

import * as React from "react";

/**
 * A per-device on/off setting kept in localStorage, read through
 * `useSyncExternalStore` so every screen showing it agrees and the server
 * render uses the default. Storage can throw (private mode, some in-app
 * browsers); then the choice lasts this visit only.
 */
interface StoredFlag {
  read: () => boolean;
  write: (on: boolean) => void;
  fallback: boolean;
}

export function createStoredFlag({ read, write, fallback }: StoredFlag) {
  const listeners = new Set<() => void>();
  let memory: boolean | null = null;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  };
  const get = () => memory ?? read();
  const set = (on: boolean) => {
    write(on);
    // Held in memory only when storage refused it, so other tabs' changes still come through.
    memory = read() === on ? null : on;
    listeners.forEach((listener) => listener());
  };

  return function useStoredFlag(): [boolean, (on: boolean) => void] {
    return [React.useSyncExternalStore(subscribe, get, () => fallback), set];
  };
}

const WATCH_CLIPBOARD_KEY = "stashh.watch-clipboard";

/** "Watch my clipboard" — on by default: the paste sheet offers to read the clipboard on a tap. */
export const useWatchClipboard = createStoredFlag({
  read: () => {
    try {
      return localStorage.getItem(WATCH_CLIPBOARD_KEY) !== "0";
    } catch {
      return true;
    }
  },
  write: (on) => {
    try {
      localStorage.setItem(WATCH_CLIPBOARD_KEY, on ? "1" : "0");
    } catch {
      /* storage unavailable: the in-memory value carries this visit */
    }
  },
  fallback: true,
});
