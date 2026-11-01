import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

/** Persistence for `web_sign_in_links`. Requires the service-role client (no RLS policies). */
export class SignInLinkRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async insert(link: { userId: string; codeHash: string; expiresAt: Date }): Promise<void> {
    const { error } = await this.supabase
      .from("web_sign_in_links")
      .insert({ user_id: link.userId, code_hash: link.codeHash, expires_at: link.expiresAt.toISOString() });
    if (error) throw error;
  }

  /** The unspent, unexpired link with this code hash; null otherwise. */
  async findRedeemable(codeHash: string, now: Date): Promise<{ id: string; userId: string } | null> {
    const { data, error } = await this.supabase
      .from("web_sign_in_links")
      .select("id, user_id")
      .eq("code_hash", codeHash)
      .is("used_at", null)
      .gt("expires_at", now.toISOString())
      .maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, userId: data.user_id } : null;
  }

  /** Spends the link; false when a concurrent redeem spent it first or it just expired. */
  async markUsed(id: string, now: Date): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("web_sign_in_links")
      .update({ used_at: now.toISOString() })
      .eq("id", id)
      .is("used_at", null)
      .gt("expires_at", now.toISOString())
      .select("id");
    if (error) throw error;
    return data.length > 0;
  }
}
