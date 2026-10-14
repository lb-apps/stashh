import { isAuthApiError, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/database.js";

/**
 * The slice of Supabase Auth administration the identity service needs. An interface so
 * the service can be tested without a live Auth server.
 */
export interface AuthUserAdmin {
  /** Creates the user with a fixed id; `exists` when that id is already registered. */
  createUser(params: { id: string; email: string; appMetadata: Record<string, unknown> }): Promise<"created" | "exists">;
  /** Deletes the user and, through FK cascades, everything it owns. */
  deleteUser(id: string): Promise<"deleted" | "not_found">;
}

export class SupabaseAuthUserAdmin implements AuthUserAdmin {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async createUser({ id, email, appMetadata }: { id: string; email: string; appMetadata: Record<string, unknown> }) {
    const { error } = await this.supabase.auth.admin.createUser({
      id,
      email,
      // The address is reserved and never receives mail; confirming it up front means
      // Auth never tries to send a confirmation.
      email_confirm: true,
      app_metadata: appMetadata,
    });
    if (!error) return "created" as const;

    if (isAuthApiError(error) && (error.code === "email_exists" || error.code === "user_already_exists")) {
      // Deterministic id + deterministic email: a prior (possibly interrupted) attempt
      // created this user. Confirm the id really is ours before treating it as success.
      const { data, error: lookupError } = await this.supabase.auth.admin.getUserById(id);
      if (lookupError) throw lookupError;
      if (data.user?.email !== email) {
        throw new Error(`Auth user conflict: ${email} is registered to a different user id`);
      }
      return "exists" as const;
    }
    throw error;
  }

  async deleteUser(id: string) {
    const { error } = await this.supabase.auth.admin.deleteUser(id);
    if (!error) return "deleted" as const;
    if (isAuthApiError(error) && error.code === "user_not_found") return "not_found" as const;
    throw error;
  }
}
