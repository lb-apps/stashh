"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { metaEvents } from "@/lib/analytics/events";
import { sendMetaEvent } from "@/lib/analytics/meta-capi";
import { redeemSignInCode } from "@/lib/auth/sign-in-link";

export type RedeemResult =
  | { ok: true; tokenHash: string; /** Shared by the pixel's and the server's copy of `map_link_opened`. */ eventId: string }
  | { ok: false; reason: "invalid" | "unavailable" };

/**
 * Redeemed by a client-side POST after the page has mounted — never during
 * the GET render — so Instagram's link-preview crawler, which fetches every
 * URL sent in a DM, never gets a session for the person.
 *
 * A valid code is also the server's moment to tell Meta the link was opened,
 * once the response is on its way. The link's owner stays on the server.
 */
export async function redeem(code: string): Promise<RedeemResult> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(code)) return { ok: false, reason: "invalid" };
  const result = await redeemSignInCode(code);
  if (!result.ok) return result;

  // A link opens any number of times; each open is its own event.
  const eventId = crypto.randomUUID();
  after(async () => {
    const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()]);
    await sendMetaEvent({
      name: metaEvents.map_link_opened,
      eventId,
      userId: result.userId,
      // The page without its code: the code signs its owner in.
      sourceUrl: `${requestHeaders.get("origin") ?? "https://stashh.me"}/app/a`,
      clientIp: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
      userAgent: requestHeaders.get("user-agent"),
      fbp: requestCookies.get("_fbp")?.value ?? null,
      fbc: requestCookies.get("_fbc")?.value ?? null,
    });
  });
  return { ok: true, tokenHash: result.tokenHash, eventId };
}
