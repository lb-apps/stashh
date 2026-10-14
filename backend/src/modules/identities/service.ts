import { v5 as uuidv5 } from "uuid";
import type { AuthUserAdmin } from "./auth-user-admin.js";
import type { ChannelIdentityRepository } from "./repository.js";
import type { ChannelProvider, ResolvedChannelIdentity } from "./types.js";

/**
 * Fixed namespace for channel-identity user ids. Changing it would orphan every
 * existing channel user, so it is a constant, not configuration.
 */
const CHANNEL_USER_NAMESPACE = "cd80b7e3-801a-49f7-ba0f-66160dd1526a";

/** The Stashh user id for a channel identity: stable, derivable, collision-free (UUIDv5). */
export function channelUserId(provider: ChannelProvider, externalId: string): string {
  return uuidv5(`${provider}:${externalId}`, CHANNEL_USER_NAMESPACE);
}

/**
 * Maps people who reach Stashh through a messaging channel to Stashh users.
 *
 * Every step is idempotent, so concurrent or retried calls for the same identity
 * converge on one user without locks:
 *   1. the user id is derived (UUIDv5), not generated;
 *   2. Auth user creation with that id treats "already exists" as success;
 *   3. the mapping insert ignores duplicates.
 * A crash between steps leaves nothing orphaned — the next call completes the rest.
 */
export class ChannelIdentityService {
  constructor(
    private readonly identities: ChannelIdentityRepository,
    private readonly authAdmin: AuthUserAdmin,
    private readonly reservedEmailDomain: string,
  ) {}

  async resolve(provider: ChannelProvider, externalId: string): Promise<ResolvedChannelIdentity> {
    const existing = await this.identities.find(provider, externalId);
    if (existing) return { ...existing, created: false };

    const userId = channelUserId(provider, externalId);
    const outcome = await this.authAdmin.createUser({
      id: userId,
      email: `${provider}-${externalId}@${this.reservedEmailDomain}`,
      appMetadata: { channel: provider },
    });
    await this.identities.insert({ provider, externalId, userId });

    return { provider, externalId, userId, created: outcome === "created" };
  }

  /**
   * Erases a channel user and all of their data (identity, recognitions, saved places,
   * lists) via the auth.users cascades. Returns false when nothing existed.
   */
  async erase(provider: ChannelProvider, externalId: string): Promise<boolean> {
    const userId = (await this.identities.find(provider, externalId))?.userId ?? channelUserId(provider, externalId);
    return (await this.authAdmin.deleteUser(userId)) === "deleted";
  }
}
