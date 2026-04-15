import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Request, Response, NextFunction } from "express";
import type { JWTPayload } from "jose";
import { config } from "../config.js";
import { sendError } from "../http/response.js";

interface SupabaseJWTPayload extends JWTPayload {
  sub: string;
  email?: string;
  role: string;
  aud: string;
  app_metadata: { provider?: string; [key: string]: unknown };
  user_metadata: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      user?: SupabaseJWTPayload;
    }
  }
}

// Verifies ES256 user access tokens via project JWKS (ECC P-256 signing keys).
// Supabase may expose multiple keys (current + previous) during rotation; jose picks the right `kid`.
const JWKS = createRemoteJWKSet(
  new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, req, 401, "UNAUTHORIZED", "Missing or malformed Authorization header");
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      audience: "authenticated",
    });

    const supabasePayload = payload as SupabaseJWTPayload;

    // Block service-role keys from accessing user-facing endpoints
    if (supabasePayload.role !== "authenticated") {
      sendError(res, req, 403, "FORBIDDEN", "Forbidden");
      return;
    }

    req.user = supabasePayload;
    next();
  } catch {
    sendError(res, req, 401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
