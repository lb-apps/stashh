import type { Request } from "express";
import { createSupabaseClientForRequest } from "../../db/supabaseClient.js";
import { rootLogger } from "../../lib/logger.js";
import { PlacesRepository } from "../places/repository.js";
import { createListsServiceFromRequest } from "../lists/factory.js";
import { LibraryRepository } from "./repository.js";
import { LibraryService } from "./service.js";

const libraryLog = rootLogger.child({ module: "library" });

export function createLibraryServiceFromRequest(req: Request): LibraryService {
  const supabase = createSupabaseClientForRequest(req);
  const listsService = createListsServiceFromRequest(req);
  return new LibraryService(
    new LibraryRepository(supabase),
    new PlacesRepository(supabase, supabase),
    listsService,
    libraryLog,
  );
}
