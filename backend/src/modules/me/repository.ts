import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

export interface ProfileRows {
  user: { created_at: string } | null;
  instagram: { username: string | null; display_name: string | null } | null;
  savedCount: number;
}

/**
 * Reads what the profile screen shows. `users` and `saved_places` go through the caller's
 * JWT (RLS); `channel_identities` has no RLS policies, so it is read with the service
 * client, filtered by the caller's id.
 */
export class MeRepository {
  constructor(
    private readonly userSupabase: SupabaseClient<Database>,
    private readonly serviceSupabase: SupabaseClient<Database>,
  ) {}

  async getProfileRows(userId: string): Promise<ProfileRows> {
    const [user, instagram, saved] = await Promise.all([
      this.userSupabase.from("users").select("created_at").eq("id", userId).maybeSingle(),
      this.serviceSupabase
        .from("channel_identities")
        .select("username, display_name")
        .eq("user_id", userId)
        .eq("provider", "instagram")
        .maybeSingle(),
      this.userSupabase.from("saved_places").select("id", { count: "exact", head: true }).eq("owner_user_id", userId),
    ]);
    if (user.error) throw user.error;
    if (instagram.error) throw instagram.error;
    if (saved.error) throw saved.error;
    return { user: user.data, instagram: instagram.data, savedCount: saved.count ?? 0 };
  }
}
