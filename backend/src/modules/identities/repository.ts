import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";
import type { ChannelIdentity, ChannelProvider } from "./types.js";

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
}
