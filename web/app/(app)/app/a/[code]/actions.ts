"use server";

import { redeemSignInCode, type RedeemResult } from "@/lib/auth/sign-in-link";

/**
 * Consumed by a client-side POST after the page has mounted — never during
 * the GET render — so Instagram's link-preview crawler, which fetches every
 * URL sent in a DM, can't burn the one-time code before the person taps it.
 */
export async function redeem(code: string): Promise<RedeemResult> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(code)) return { ok: false, reason: "expired" };
  return redeemSignInCode(code);
}
