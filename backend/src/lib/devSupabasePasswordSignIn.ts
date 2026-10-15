import { config } from "../config.js";

type DevPasswordSignInResult =
  | { ok: true; access_token: string }
  | {
      ok: false;
      error: "missing_env" | "auth_failed";
      message?: string;
      httpStatus?: number;
    };

/**
 * Supabase password grant for the test user (`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`): the
 * identity operator tools use to call the public API as the app would. Served by
 * `/internal/v1/ops/test-user-token` (service token), `/dev/token` (development only) and
 * the Scalar docs prefill (development only).
 */
export async function signInDevTestUser(): Promise<DevPasswordSignInResult> {
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
