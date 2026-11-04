import "server-only";

/**
 * Redeems a DM sign-in link. The Instagram bot sends each person a personal
 * code that keeps working; the backend's internal API resolves it to a Supabase
 * `token_hash` that the browser exchanges for a session with `verifyOtp`.
 * The service token never leaves the Next server.
 */
export type RedeemResult = { ok: true; tokenHash: string } | { ok: false; reason: "invalid" | "unavailable" };

export async function redeemSignInCode(code: string): Promise<RedeemResult> {
  const baseUrl = process.env.STASHH_API_URL;
  const token = process.env.STASHH_INTERNAL_TOKEN;
  if (!baseUrl || !token) return { ok: false, reason: "unavailable" };

  const response = await fetch(new URL("/internal/v1/sign-in-links/redeem", baseUrl), {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch(() => null);

  if (!response) return { ok: false, reason: "unavailable" };
  const body = (await response.json().catch(() => null)) as { ok?: boolean; data?: { token_hash?: string } } | null;
  if (response.ok && body?.ok && body.data?.token_hash) return { ok: true, tokenHash: body.data.token_hash };
  return { ok: false, reason: response.status >= 500 ? "unavailable" : "invalid" };
}
