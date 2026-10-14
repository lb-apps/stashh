import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createServiceAuth } from "../src/middleware/serviceAuth.js";

const TOKEN_A = "a".repeat(40);
const TOKEN_B = "b".repeat(40);

function run(tokens: string[], authorization?: string) {
  const req = { headers: authorization ? { authorization } : {}, requestId: "test" } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  createServiceAuth(tokens)(req, res, next);
  return { req, res, next };
}

describe("createServiceAuth", () => {
  it("passes a configured token and marks the request as a service call", () => {
    const { req, next } = run([TOKEN_A], `Bearer ${TOKEN_A}`);
    expect(next).toHaveBeenCalledOnce();
    expect(req.servicePrincipal).toEqual({ kind: "service" });
  });

  it("accepts any of several tokens, so rotation needs no downtime", () => {
    expect(run([TOKEN_A, TOKEN_B], `Bearer ${TOKEN_B}`).next).toHaveBeenCalledOnce();
  });

  it.each([
    ["no header", undefined],
    ["wrong scheme", `Basic ${TOKEN_A}`],
    ["unknown token", `Bearer ${"c".repeat(40)}`],
    ["prefix of a valid token", `Bearer ${TOKEN_A.slice(0, 20)}`],
  ])("rejects %s with 401", (_label, header) => {
    const { res, next } = run([TOKEN_A], header);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
