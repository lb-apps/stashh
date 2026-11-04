"use server";

import { redeemSignInCode, type RedeemResult } from "@/lib/auth/sign-in-link";

/**
 * Redeemed by a client-side POST after the page has mounted — never during
 * the GET render — so Instagram's link-preview crawler, which fetches every
 * URL sent in a DM, never gets a session for the person.
 */
export async function redeem(code: string): Promise<RedeemResult> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(code)) return { ok: false, reason: "invalid" };
  return redeemSignInCode(code);
}
