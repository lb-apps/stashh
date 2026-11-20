import { createClient } from "@supabase/supabase-js";
import type { Config } from "../config.ts";

export function createSupabaseClient(config: Config) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
