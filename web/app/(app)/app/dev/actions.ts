"use server";

/**
 * Development only: signs in as the backend's test user (`DEV_TEST_EMAIL`) so
 * the app can be run locally without a DM link. Returns null in production.
 */
export async function devSignIn(): Promise<{ access_token: string; refresh_token: string } | null> {
  if (process.env.NODE_ENV === "production") return null;
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, DEV_TEST_EMAIL: email, DEV_TEST_PASSWORD: password } =
    process.env;
  if (!url || !key || !email || !password) return null;

  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token: string; refresh_token: string };
  return { access_token: body.access_token, refresh_token: body.refresh_token };
}
