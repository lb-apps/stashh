import { createHash, randomBytes } from "node:crypto";
import { AppHttpError } from "../../errors/appHttpError.js";
import type { MagicLinkIssuer } from "./magic-link-issuer.js";
import type { SignInLinkRepository } from "./repository.js";
import type { MintedSignInLink, RedeemedSignInLink } from "./types.js";

/** How long a DM sign-in link works. */
export const SIGN_IN_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FOREIGN_KEY_VIOLATION = "23503";

export function hashSignInCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/**
 * Personal, one-time links that sign a person in to the web app.
 *
 * Minted for the DM channel, which sends the link to the person it belongs to. Redeemed by
 * the web app's server: the link becomes a Supabase magic-link token the browser exchanges
 * for a session (`verifyOtp`), so no password, OAuth or mailbox is involved. The code is
 * random (24 bytes) and stored only as its SHA-256.
 */
export class SignInLinkService {
  constructor(
    private readonly links: SignInLinkRepository,
    private readonly issuer: MagicLinkIssuer,
    private readonly webAppUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async mint(userId: string): Promise<MintedSignInLink> {
    const code = randomBytes(24).toString("base64url");
    const expiresAt = new Date(this.now().getTime() + SIGN_IN_LINK_TTL_MS);
    try {
      await this.links.insert({ userId, codeHash: hashSignInCode(code), expiresAt });
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code === FOREIGN_KEY_VIOLATION) {
        throw new AppHttpError(404, "User not found", "USER_NOT_FOUND");
      }
      throw error;
    }
    return { url: `${this.webAppUrl}/a/${code}`, expires_at: expiresAt.toISOString() };
  }

  /**
   * Spends the link and returns a magic-link token for its owner; null when the code is
   * unknown, used or expired. The token is issued before the link is spent, so a failing
   * Auth call leaves the link usable; of two concurrent redeems, only one gets a token.
   */
  async redeem(code: string): Promise<RedeemedSignInLink | null> {
    const now = this.now();
    const link = await this.links.findRedeemable(hashSignInCode(code), now);
    if (!link) return null;

    const tokenHash = await this.issuer.issue(link.userId);
    if (!tokenHash) return null;
    if (!(await this.links.markUsed(link.id, now))) return null;

    return { user_id: link.userId, token_hash: tokenHash, type: "magiclink" };
  }
}
