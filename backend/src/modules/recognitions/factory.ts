import type { Request } from "express";
import { createSupabaseClientForRequest, createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { RecognitionRepository } from "./repository.js";
import { RecognitionService } from "./service.js";

/**
 * User-scoped: every query runs under the caller's JWT, so RLS applies. Reads only: people
 * may read their own tasks but never write them.
 */
export function createRecognitionServiceForRequest(req: Request): RecognitionService {
  return new RecognitionService(new RecognitionRepository(createSupabaseClientForRequest(req)));
}

/**
 * Service-role: bypasses RLS. Only for trusted server paths — the worker, the internal API,
 * and the public routes that write (creating and committing a task) — which scope every
 * query by an explicit owner id from a verified JWT or a service-authenticated route.
 */
export function createRecognitionServiceWithServiceRole(): RecognitionService {
  return new RecognitionService(new RecognitionRepository(createSupabaseServiceClient()));
}
