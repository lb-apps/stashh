import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

/** Persistence for `web_sign_in_links`. Requires the service-role client (no RLS policies). */
export class SignInLinkRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async insert(link: { userId: string; codeHash: string }): Promise<void> {
    const { error } = await this.supabase.from("web_sign_in_links").insert({ user_id: link.userId, code_hash: link.codeHash });
    if (error) throw error;
  }

  /** The owner of the link with this code hash; null when there is none. */
  async findOwner(codeHash: string): Promise<string | null> {
    const { data, error } = await this.supabase.from("web_sign_in_links").select("user_id").eq("code_hash", codeHash).maybeSingle();
    if (error) throw error;
    return data?.user_id ?? null;
  }
}
