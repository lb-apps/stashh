import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInDevTestUser = vi.fn();
vi.mock("../src/lib/devSupabasePasswordSignIn.js", () => ({ signInDevTestUser }));

const { sendTestUserToken } = await import("../src/modules/ops/test-user-token.js");

function run() {
  const req = { requestId: "test" } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  return { req, res };
}

const body = (res: Response) => (res.json as ReturnType<typeof vi.fn>).mock.calls[0]![0];

describe("sendTestUserToken", () => {
  beforeEach(() => signInDevTestUser.mockReset());

  it("answers with the token and who it is for", async () => {
    signInDevTestUser.mockResolvedValue({ ok: true, access_token: "jwt" });
    const { req, res } = run();
    await sendTestUserToken(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body(res).data).toMatchObject({ access_token: "jwt" });
  });

  it("is 503 when the test user is not configured, so the caller knows what to set", async () => {
    signInDevTestUser.mockResolvedValue({ ok: false, error: "missing_env" });
    const { req, res } = run();
    await sendTestUserToken(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(body(res).error.message).toContain("DEV_TEST_EMAIL");
  });

  it("passes Supabase's refusal through with its status", async () => {
    signInDevTestUser.mockResolvedValue({ ok: false, error: "auth_failed", message: "Invalid login credentials", httpStatus: 400 });
    const { req, res } = run();
    await sendTestUserToken(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).error.message).toBe("Invalid login credentials");
  });
});
