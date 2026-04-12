import type { Request, Response } from "express";
import { createSupabaseClientForRequest, createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { sendError } from "../../http/response.js";
import { RecognitionRepository } from "../recognitions/repository.js";
import { PlacesRepository } from "./repository.js";
import { PlacesService } from "./service.js";

/**
 * Builds PlacesService with user-scoped + service-role Supabase (for canonical `places` writes).
 */
export function createPlacesServiceFromRequest(req: Request): PlacesService {
  const userSb = createSupabaseClientForRequest(req);
  const serviceSb = createSupabaseServiceClient();
  return new PlacesService(new PlacesRepository(userSb, serviceSb), new RecognitionRepository(userSb));
}

/**
 * User-scoped PlacesService (both DB clients use the JWT). Use only for ownership checks
 * and other operations that do not require service-role `places` writes — avoids requiring
 * SUPABASE_SECRET_KEY on the caller.
 */
export function createPlacesAuthOnlyServiceFromRequest(req: Request): PlacesService {
  const userSb = createSupabaseClientForRequest(req);
  return new PlacesService(new PlacesRepository(userSb, userSb), new RecognitionRepository(userSb));
}

/** Returns null and sends 503 if service-role Supabase is not configured. */
export function tryCreatePlacesServiceFromRequestOr503(req: Request, res: Response): PlacesService | null {
  try {
    return createPlacesServiceFromRequest(req);
  } catch {
    sendError(res, req, 503, "SERVICE_UNAVAILABLE", "Places service is not configured");
    return null;
  }
}
