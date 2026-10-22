import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";
import type { ChannelIdentity, ChannelProfile, ChannelProvider } from "./types.js";

/** Persistence for `channel_identities`. Requires the service-role client (table has no RLS policies). */
export class ChannelIdentityRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async find(provider: ChannelProvider, externalId: string): Promise<ChannelIdentity | null> {
    const { data, error } = await this.supabase
      .from("channel_identities")
      .select("user_id")
      .eq("provider", provider)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) throw error;
    return data ? { provider, externalId, userId: data.user_id } : null;
  }

  /** Inserts the mapping; a concurrent insert of the same identity is a no-op. */
  async insert(identity: ChannelIdentity): Promise<void> {
    const { error } = await this.supabase
      .from("channel_identities")
      .upsert(
        { provider: identity.provider, external_id: identity.externalId, user_id: identity.userId },
        { onConflict: "provider,external_id", ignoreDuplicates: true },
      );

    if (error) throw error;
  }

  /** Overwrites the identity's profile with what the channel returned just now; false when there is no such identity. */
  async saveProfile(provider: ChannelProvider, externalId: string, profile: ChannelProfile): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("channel_identities")
      .update({ username: profile.username, display_name: profile.name, profile_synced_at: new Date().toISOString() })
      .eq("provider", provider)
      .eq("external_id", externalId)
      .select("external_id");

    if (error) throw error;
    return data.length > 0;
  }

  /**
   * External ids whose profile was never fetched or was last fetched before `syncedBefore`,
   * in `external_id` order from after the `after` cursor.
   */
  async listProfileStale(
    provider: ChannelProvider,
    { syncedBefore, after, limit }: { syncedBefore: Date; after?: string; limit: number },
  ): Promise<string[]> {
    let query = this.supabase
      .from("channel_identities")
      .select("external_id")
      .eq("provider", provider)
      .or(`profile_synced_at.is.null,profile_synced_at.lt.${syncedBefore.toISOString()}`)
      .order("external_id")
      .limit(limit);
    if (after !== undefined) query = query.gt("external_id", after);

    const { data, error } = await query;
    if (error) throw error;
    return data.map((row) => row.external_id);
  }
}
