"use client";

import { publicEnv } from "@/lib/env";
import type { MetaEventName } from "./events";

/**
 * The Meta Pixel, for the few events in `metaEvents` (events.ts). Only
 * analytics.ts calls this. The script is requested on the first such event, so
 * a page that sends none never loads it; without a pixel id every call is a
 * no-op.
 *
 * Nothing is collected on its own: no page views (not on load, not on route
 * changes) and no button or page-metadata capture. Each event carries the id
 * the server sent to the Conversions API for the same action, so Meta counts
 * the pair once.
 */

const SCRIPT_URL = "https://connect.facebook.net/en_US/fbevents.js";

interface Fbq {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** Meta's base snippet: a queue the script drains once it has loaded. */
function install(pixelId: string, userId: string): Fbq {
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  }) as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // The app router's navigations are not page views we report to Meta.
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_URL;
  document.head.appendChild(script);

  fbq("set", "autoConfig", false, pixelId);
  // The Supabase user id; the pixel hashes it before it leaves the browser.
  fbq("init", pixelId, { external_id: userId });
  return fbq;
}

export function sendPixelEvent(name: MetaEventName, meta: { eventId: string; userId: string }) {
  const pixelId = publicEnv.metaPixelId;
  if (!pixelId || typeof window === "undefined") return;
  const fbq = window.fbq ?? install(pixelId, meta.userId);
  fbq("trackCustom", name, {}, { eventID: meta.eventId });
}
