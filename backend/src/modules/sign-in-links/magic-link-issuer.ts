import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

/** Issues a Supabase Auth magic-link token for a user, without sending any mail. */
export interface MagicLinkIssuer {
  /** The hashed token for `verifyOtp({ token_hash, type: "magiclink" })`; null when the user is gone. */
  issue(userId: string): Promise<string | null>;
}

export class SupabaseMagicLinkIssuer implements MagicLinkIssuer {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async issue(userId: string): Promise<string | null> {
    const { data: found, error: lookupError } = await this.supabase.auth.admin.getUserById(userId);
    if (lookupError) {
      if (lookupError.status === 404) return null;
      throw lookupError;
    }
    const email = found.user?.email;
    if (!email) return null;

    // Admin generateLink only returns the link; it never mails it.
    const { data, error } = await this.supabase.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    return data.properties.hashed_token;
  }
}
