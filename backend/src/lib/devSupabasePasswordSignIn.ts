import { config } from "../config.js";

export type DevPasswordSignInResult =
  | { ok: true; access_token: string }
  | {
      ok: false;
      error: "production" | "missing_env" | "auth_failed";
      message?: string;
      httpStatus?: number;
    };

/**
 * Local dev only: Supabase password grant for `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`.
 * Used by `/dev/token` and Scalar docs prefill — never call in production.
 */
export async function signInDevTestUser(): Promise<DevPasswordSignInResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "production" };
  }

  const { SUPABASE_URL, supabasePublishableKey, DEV_TEST_EMAIL, DEV_TEST_PASSWORD } = config;
  if (!supabasePublishableKey || !DEV_TEST_EMAIL || !DEV_TEST_PASSWORD) {
    return { ok: false, error: "missing_env" };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: DEV_TEST_EMAIL, password: DEV_TEST_PASSWORD }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const message =
        (body["error_description"] as string | undefined) ??
        (body["msg"] as string | undefined) ??
        "Supabase auth failed";
      const httpStatus = response.status >= 400 && response.status < 600 ? response.status : 401;
      return { ok: false, error: "auth_failed", message, httpStatus };
    }

    const data = (await response.json()) as { access_token: string };
    return { ok: true, access_token: data.access_token };
  } catch (err) {
    console.error("[dev] signInDevTestUser", err);
    return {
      ok: false,
      error: "auth_failed",
      message: "Authentication request failed",
      httpStatus: 500,
    };
  }
}
