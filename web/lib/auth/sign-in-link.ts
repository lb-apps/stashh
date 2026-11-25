import "server-only";
import type { TaskReward } from "@/lib/stashh/types";

/**
 * Redeems a DM sign-in link. The Instagram bot sends each person a personal
 * code that keeps working; the backend's internal API resolves it to a Supabase
 * `token_hash` that the browser exchanges for a session with `verifyOtp`.
 * The service token never leaves the Next server.
 */
export type RedeemedCode =
  | {
      ok: true;
      tokenHash: string;
      /** The link's owner. Stays on the server. */
      userId: string;
      /** Credits this first visit to the web earned; null on every later one. */
      reward: TaskReward | null;
    }
  | { ok: false; reason: "invalid" | "unavailable" };

export async function redeemSignInCode(code: string): Promise<RedeemedCode> {
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
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: { token_hash?: string; user_id?: string; reward?: { task?: unknown; credits?: unknown } | null };
  } | null;
  if (response.ok && body?.ok && body.data?.token_hash && body.data.user_id) {
    return { ok: true, tokenHash: body.data.token_hash, userId: body.data.user_id, reward: webVisitReward(body.data.reward) };
  }
  return { ok: false, reason: response.status >= 500 ? "unavailable" : "invalid" };
}

/** The first web visit's reward, only in the shape the backend documents; anything else is no reward. */
function webVisitReward(reward: { task?: unknown; credits?: unknown } | null | undefined): TaskReward | null {
  const task = reward?.task;
  const credits = reward?.credits;
  return task === "first_web_visit" && typeof credits === "number" && Number.isInteger(credits) && credits > 0 ? { task, credits } : null;
}
