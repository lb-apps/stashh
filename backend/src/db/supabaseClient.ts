import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import WebSocket from "ws";
import { config } from "../config.js";
import type { Database } from "../types/database.js";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/**
 * User-scoped Supabase client: PostgREST runs as `authenticated` with RLS enforced.
 * Call only after `requireAuth` (or equivalent) has populated `req.user`.
 */
export function createSupabaseClientForRequest(req: Request): SupabaseClient<Database> {
  const publishableKey = config.supabasePublishableKey;
  if (!publishableKey) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY must be set for database access",
    );
  }

  const accessToken = extractBearerToken(req);
  if (!accessToken) {
    throw new Error("Missing Authorization bearer token");
  }

  return createClient<Database>(config.SUPABASE_URL, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Service-role client — bypasses RLS. Use only in trusted server paths (jobs, admin).
 */
export function createSupabaseServiceClient(): SupabaseClient<Database> {
  const secretKey = config.supabaseSecretKey;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY must be set for service-level database access");
  }
  return createClient<Database>(config.SUPABASE_URL, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Realtime client for postgres_changes subscriptions in Node.js.
 * WebSocket transport must be set explicitly (no native WebSocket in Node).
 */
export function createSupabaseRealtimeClient(): SupabaseClient<Database> | null {
  const key = config.supabasePublishableKey;
  if (!key) return null;
  return createClient<Database>(config.SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      transport: WebSocket as unknown as typeof globalThis.WebSocket,
    },
  });
}
