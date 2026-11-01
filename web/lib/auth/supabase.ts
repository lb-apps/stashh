"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "../env";

let client: SupabaseClient | null = null;

/**
 * The browser's Supabase client — used for auth only; data goes through the
 * Stashh API. One instance per page so every caller shares the session and a
 * single refresh timer.
 *
 * In an in-app browser the storage belongs to the host app and may be cleared;
 * the session is a convenience, never the source of truth. When it is gone the
 * reader asks the DM for a fresh link.
 */
export function supabase(): SupabaseClient {
  client ??= createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Sign-in arrives as a one-time token_hash we verify ourselves, never in the URL.
      detectSessionInUrl: false,
      storageKey: "stashh.session",
    },
  });
  return client;
}
