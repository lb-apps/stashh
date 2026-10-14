import type { Request } from "express";
import { createSupabaseClientForRequest, createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { RecognitionRepository } from "./repository.js";
import { RecognitionService } from "./service.js";

/** User-scoped: every query runs under the caller's JWT, so RLS applies. */
export function createRecognitionServiceForRequest(req: Request): RecognitionService {
  return new RecognitionService(new RecognitionRepository(createSupabaseClientForRequest(req)));
}

/**
 * Service-role: bypasses RLS. Only for trusted server paths — the worker and the
 * internal API — which scope every query by an explicit owner id instead.
 */
export function createRecognitionServiceWithServiceRole(): RecognitionService {
  return new RecognitionService(new RecognitionRepository(createSupabaseServiceClient()));
}
