import type { Request, Response } from "express";
import { config } from "../../config.js";
import { sendError, sendSuccess } from "../../http/response.js";
import { signInDevTestUser } from "../../lib/devSupabasePasswordSignIn.js";

/**
 * Answers with a fresh access token for the test user (`DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD`),
 * so an operator tool can call the public API exactly as the app does. Served behind the
 * service token as `GET /internal/v1/ops/test-user-token` and, in development only, as
 * `GET /dev/token`. `503` when the test user is not configured.
 */
export async function sendTestUserToken(req: Request, res: Response): Promise<void> {
  const result = await signInDevTestUser();
  if (!result.ok) {
    if (result.error === "missing_env") {
      sendError(
        res,
        req,
        503,
        "SERVICE_UNAVAILABLE",
        "DEV_TEST_EMAIL, DEV_TEST_PASSWORD, and SUPABASE_PUBLISHABLE_KEY (or legacy SUPABASE_ANON_KEY) must be set",
      );
      return;
    }
    sendError(res, req, result.httpStatus ?? 401, "UNAUTHORIZED", result.message ?? "Supabase auth failed");
    return;
  }

  sendSuccess(res, req, 200, { access_token: result.access_token, email: config.DEV_TEST_EMAIL ?? null });
}
