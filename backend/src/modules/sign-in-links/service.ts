import { createHash, randomBytes } from "node:crypto";
import { AppHttpError } from "../../errors/appHttpError.js";
import type { MagicLinkIssuer } from "./magic-link-issuer.js";
import type { SignInLinkRepository } from "./repository.js";
import type { MintedSignInLink, RedeemedSignInLink } from "./types.js";

const FOREIGN_KEY_VIOLATION = "23503";

export function hashSignInCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/**
 * Personal links that sign a person in to the web app.
 *
 * Minted for the DM channel, which sends the link to the person it belongs to. Redeemed by
 * the web app's server: the link becomes a Supabase magic-link token the browser exchanges
 * for a session (`verifyOtp`), so no password, OAuth or mailbox is involved. A link works
 * every time it is opened, until its owner is erased. The code is random (24 bytes) and
 * stored only as its SHA-256.
 */
export class SignInLinkService {
  constructor(
    private readonly links: SignInLinkRepository,
    private readonly issuer: MagicLinkIssuer,
    private readonly webAppUrl: string,
  ) {}

  async mint(userId: string): Promise<MintedSignInLink> {
    const code = randomBytes(24).toString("base64url");
    try {
      await this.links.insert({ userId, codeHash: hashSignInCode(code) });
    } catch (error) {
      if ((error as { code?: unknown } | null)?.code === FOREIGN_KEY_VIOLATION) {
        throw new AppHttpError(404, "User not found", "USER_NOT_FOUND");
      }
      throw error;
    }
    return { url: `${this.webAppUrl}/a/${code}` };
  }

  /** A fresh magic-link token for the link's owner; null when the code is unknown or its owner is gone. */
  async redeem(code: string): Promise<RedeemedSignInLink | null> {
    const userId = await this.links.findOwner(hashSignInCode(code));
    if (!userId) return null;

    const tokenHash = await this.issuer.issue(userId);
    if (!tokenHash) return null;

    return { user_id: userId, token_hash: tokenHash, type: "magiclink" };
  }
}
