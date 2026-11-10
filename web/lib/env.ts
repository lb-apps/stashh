/**
 * Public configuration of the app, inlined at build time. Each value is read
 * with a literal `process.env.NEXT_PUBLIC_*` access so Next can replace it.
 * A missing value fails loudly on first use instead of producing a broken map
 * or an anonymous API call.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy web/.env.example to web/.env.local and fill it in.`);
  return value;
}

export const publicEnv = {
  get apiUrl() {
    return required("NEXT_PUBLIC_STASHH_API_URL", process.env.NEXT_PUBLIC_STASHH_API_URL);
  },
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabasePublishableKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
  get mapboxToken() {
    return required("NEXT_PUBLIC_MAPBOX_TOKEN", process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  },
  /** Optional: without it analytics stays off (local dev, CI). */
  get mixpanelToken(): string | null {
    return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || null;
  },
  /** Optional: without it nothing is sent to Meta, from the browser or the server. */
  get metaPixelId(): string | null {
    return process.env.NEXT_PUBLIC_META_PIXEL_ID || null;
  },
  /** `production` only on stashh.me; tags every event so a wrong token shows up at once. */
  get appEnv(): string {
    return process.env.NEXT_PUBLIC_APP_ENV || "development";
  },
};
