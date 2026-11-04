import { z } from "zod";

/** A link's code as it appears in `/a/<code>`: 32 url-safe characters (24 random bytes). */
export const signInCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/, "code must be 32 of [A-Za-z0-9_-]");

export const redeemSignInLinkBodySchema = z.object({ code: signInCodeSchema });

export interface MintedSignInLink {
  url: string;
}

/** What the web app turns into a session: `supabase.auth.verifyOtp({ token_hash, type })`. */
export interface RedeemedSignInLink {
  user_id: string;
  token_hash: string;
  type: "magiclink";
}
