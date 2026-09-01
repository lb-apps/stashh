import { Router } from "express";
import { sendError, sendSuccess } from "../../http/response.js";
import { createLibraryServiceFromRequest } from "./factory.js";

export const libraryRouter = Router();

/**
 * GET /api/v1/library
 *
 * Returns the full Library page summary for the authenticated user:
 *   - districts: grouped place counts by district
 *   - categories: grouped place counts by category
 *   - lists: user-created lists with emoji and place count
 *   - total_saved_count: total number of saved places
 *
 * The mobile client combines this endpoint with the paginated GET /api/v1/places
 * (for the "All Places" section) to build the complete Library page.
 */
libraryRouter.get("/", async (req, res, next) => {
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const service = createLibraryServiceFromRequest(req);
    const data = await service.getLibrarySummary(ownerUserId);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});
