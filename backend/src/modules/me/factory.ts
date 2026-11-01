import type { Request } from "express";
import { createSupabaseClientForRequest, createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { MeRepository } from "./repository.js";
import { MeService } from "./service.js";

export function createMeServiceFromRequest(req: Request): MeService {
  return new MeService(new MeRepository(createSupabaseClientForRequest(req), createSupabaseServiceClient()));
}
