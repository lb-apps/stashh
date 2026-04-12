import type { Request } from "express";
import { createSupabaseClientForRequest } from "../../db/supabaseClient.js";
import { createPlacesAuthOnlyServiceFromRequest } from "../places/factory.js";
import { ListsRepository } from "./repository.js";
import { ListsService } from "./service.js";

export function createListsServiceFromRequest(req: Request): ListsService {
  const supabase = createSupabaseClientForRequest(req);
  const placesService = createPlacesAuthOnlyServiceFromRequest(req);
  return new ListsService(new ListsRepository(supabase), placesService);
}
