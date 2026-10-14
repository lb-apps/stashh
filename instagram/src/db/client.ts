import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.ts";

export type Db = SupabaseClient<Database>;

/** Service-role client: the channel's tables have RLS on and no policies, so only this key reaches them. */
export function createDb(options: { url: string; secretKey: string }): Db {
  return createClient<Database>(options.url, options.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
