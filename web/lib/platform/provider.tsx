"use client";

import * as React from "react";
import type { InAppBrowser, MobileOS } from "./in-app-browser";

export interface Platform {
  inAppBrowser: InAppBrowser;
  os: MobileOS;
}

const PlatformContext = React.createContext<Platform>({ inAppBrowser: null, os: "other" });

/** Detected once on the server from the request's user agent. */
export function PlatformProvider({ value, children }: { value: Platform; children: React.ReactNode }) {
  return <PlatformContext value={value}>{children}</PlatformContext>;
}

export function usePlatform(): Platform {
  return React.use(PlatformContext);
}
