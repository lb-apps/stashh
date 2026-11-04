import type { Request } from "express";
import { createSupabaseClientForRequest, createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { rootLogger } from "../../lib/logger.js";
import { createPlacesAuthOnlyServiceFromRequest, createPlacesServiceWithServiceRole } from "../places/factory.js";
import { ListsRepository } from "./repository.js";
import { ListsService } from "./service.js";

const listsLog = rootLogger.child({ module: "lists" });

export function createListsServiceFromRequest(req: Request): ListsService {
  const supabase = createSupabaseClientForRequest(req);
  const placesService = createPlacesAuthOnlyServiceFromRequest(req);
  return new ListsService(new ListsRepository(supabase), placesService, listsLog);
}

/**
 * Service-role ListsService for trusted server paths (the DM assistant) that act for an
 * explicit owner. Every query filters by that owner, not by RLS.
 */
export function createListsServiceWithServiceRole(): ListsService {
  const serviceSb = createSupabaseServiceClient();
  return new ListsService(new ListsRepository(serviceSb), createPlacesServiceWithServiceRole(), listsLog);
}
