"use client";

import type { Config, Mixpanel } from "mixpanel-browser";
import { publicEnv } from "@/lib/env";
import { detectInAppBrowser, type InAppBrowser } from "@/lib/platform/in-app-browser";
import type { EventName, EventProps } from "./events";

/**
 * Mixpanel for the interfaces people use (stashh.me and /app). One SDK
 * instance per page, loaded on first use with a dynamic import so the landing
 * page's bundle never carries it; calls made before it loads run in order once
 * it has. Without a token every call is a no-op (local dev without one, CI).
 *
 * Identity: the Supabase user id is the Mixpanel user id. `identify` runs only
 * once a session exists, never with an anonymous id; `reset` only on an
 * explicit sign-out, so a signed-out visitor keeps one device id.
 */

/**
 * Session replay stays off: a code constant, not an env value, so no deploy
 * setting can start recording people. Heatmaps and autocapture likewise — the
 * catalog in events.ts is what we measure.
 */
const RECORD_SESSIONS_PERCENT = 0;

/**
 * Properties every event carries. Added by a `before_track` hook rather than
 * `register`: the SDK sends the first page view inside `init`, before any
 * register could run, and `reset` wipes registered properties.
 */
export interface EventContext {
  /** `production` on stashh.me; a wrong token shows up at once. */
  app_env: string;
  /** The app whose in-app browser the visit is in; most visits come from Instagram's. */
  in_app_browser?: NonNullable<InAppBrowser>;
}

export function buildInitOptions(context: EventContext): Partial<Config> {
  const production = context.app_env === "production";
  return {
    // EU data residency, the project's region.
    api_host: "https://api-eu.mixpanel.com",
    // No cookie: the id lives in localStorage, which the in-app browsers keep per app.
    persistence: "localStorage",
    // App Router navigations change the path; query strings carry nothing we report on.
    track_pageview: "url-with-path",
    // UTMs ride on the landing page's events only; first or last touch is a report setting.
    stop_utm_persistence: true,
    // Do Not Track is retired in browsers and not a consent signal.
    ignore_dnt: true,
    autocapture: false,
    record_sessions_percent: RECORD_SESSIONS_PERCENT,
    record_heatmap_data: false,
    // Batched with retry in production; sent at once in development so events show up live.
    batch_requests: production,
    debug: !production,
    hooks: {
      before_track: (name, properties) => [name, { ...properties, ...context }],
    },
  };
}

let loading: Promise<Mixpanel | null> | null = null;

function sdk(): Promise<Mixpanel | null> {
  loading ??= (async () => {
    const token = publicEnv.mixpanelToken;
    if (!token || typeof window === "undefined") return null;
    // The core build: no session recorder (rrweb), which we never turn on — a third of the default build's size.
    const { default: mixpanel } = await import("mixpanel-browser/dist/mixpanel-core.cjs");
    const inAppBrowser = detectInAppBrowser(navigator.userAgent);
    mixpanel.init(token, buildInitOptions({ app_env: publicEnv.appEnv, ...(inAppBrowser ? { in_app_browser: inAppBrowser } : {}) }));
    return mixpanel;
  })().catch(() => null);
  return loading;
}

function run(action: (mixpanel: Mixpanel) => void) {
  void sdk().then((mixpanel) => {
    if (mixpanel) action(mixpanel);
  });
}

/** Loads the SDK, which records the page view. Pages call it once on mount. */
export function startAnalytics() {
  run(() => {});
}

/**
 * `leavesPage` for a click that navigates away in the same tab (links open in
 * place: popups break in in-app browsers). The event then goes out at once by
 * sendBeacon instead of waiting in the batch queue the navigation would cut off.
 */
export function track<N extends EventName>(name: N, props: EventProps<N>, options?: { leavesPage?: boolean }) {
  run((mixpanel) => mixpanel.track(name, props, options?.leavesPage ? { transport: "sendBeacon", send_immediately: true } : undefined));
}

/**
 * The signed-in user's Supabase id. Another person's id on this device (a
 * second Instagram account opening its DM link in the same in-app browser)
 * gets a reset first, so the two are never merged into one profile.
 */
export function identify(userId: string) {
  run((mixpanel) => {
    const current: unknown = mixpanel.get_property("$user_id");
    if (current === userId) return;
    if (current) mixpanel.reset();
    mixpanel.identify(userId);
  });
}

/**
 * Profile fields, the only place personal data goes. Missing values are left
 * out so they never blank an existing one.
 */
export function setProfile(profile: { name: string | null; instagramUsername: string | null; createdAt: string | null }) {
  const fields: Record<string, string> = {};
  if (profile.name) fields.$name = profile.name;
  if (profile.instagramUsername) fields.instagram_username = profile.instagramUsername;
  if (profile.createdAt) fields.$created = profile.createdAt;
  if (Object.keys(fields).length) run((mixpanel) => mixpanel.people.set(fields));
}

/** After an explicit sign-out: a fresh device id, so the next person is not filed under this one. */
export function reset() {
  run((mixpanel) => mixpanel.reset());
}
