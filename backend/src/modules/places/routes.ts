import { Router } from "express";
import { z } from "zod";
import { sendCreated, sendError, sendNoContent, sendSuccess } from "../../http/response.js";
import { tryCreatePlacesServiceFromRequestOr503 } from "./factory.js";
import {
  addPlacesBodySchema,
  patchSavedPlaceBodySchema,
  placePhotosQuerySchema,
  placesListQuerySchema,
} from "./types.js";

export const placesRouter = Router();

const userPlaceIdParamsSchema = z.object({
  userPlaceId: z.string().uuid(),
});

const canonicalPlaceIdParamsSchema = z.object({
  placeId: z.string().uuid(),
});

placesRouter.get("/", async (req, res, next) => {
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  const parsedQuery = placesListQuerySchema.safeParse({
    limit: req.query["limit"],
    cursor: typeof req.query["cursor"] === "string" ? req.query["cursor"] : undefined,
  });
  if (!parsedQuery.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid query", parsedQuery.error.flatten().fieldErrors);
    return;
  }
  try {
    const service = tryCreatePlacesServiceFromRequestOr503(req, res);
    if (!service) return;
    const result = await service.listSavedPlaces(ownerUserId, parsedQuery.data);
    sendSuccess(res, req, 200, result.data, result.pagination);
  } catch (err) {
    next(err);
  }
});

placesRouter.post("/", async (req, res, next) => {
  const parsedBody = addPlacesBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const service = tryCreatePlacesServiceFromRequestOr503(req, res);
    if (!service) return;
    const data = await service.addPlaces(ownerUserId, parsedBody.data);
    sendCreated(res, req, data);
  } catch (err) {
    next(err);
  }
});

/** On-demand photo URLs for a canonical place (user must have saved it). */
placesRouter.get("/photos/:placeId", async (req, res, next) => {
  const parsedParams = canonicalPlaceIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid place id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const parsedQuery = placePhotosQuerySchema.safeParse({
    limit: req.query["limit"],
    max_width_px: req.query["max_width_px"],
  });
  if (!parsedQuery.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid query", parsedQuery.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const service = tryCreatePlacesServiceFromRequestOr503(req, res);
    if (!service) return;
    const data = await service.getPlacePhotoUrls(
      ownerUserId,
      parsedParams.data.placeId,
      parsedQuery.data.limit,
      parsedQuery.data.max_width_px,
    );
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});

placesRouter.patch("/:userPlaceId", async (req, res, next) => {
  const parsedParams = userPlaceIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid saved place id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const parsedBody = patchSavedPlaceBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request body", parsedBody.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const service = tryCreatePlacesServiceFromRequestOr503(req, res);
    if (!service) return;
    const data = await service.patchSavedPlace(ownerUserId, parsedParams.data.userPlaceId, parsedBody.data);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});

placesRouter.delete("/:userPlaceId", async (req, res, next) => {
  const parsedParams = userPlaceIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid saved place id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const service = tryCreatePlacesServiceFromRequestOr503(req, res);
    if (!service) return;
    await service.deleteSavedPlace(ownerUserId, parsedParams.data.userPlaceId);
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

placesRouter.get("/:userPlaceId", async (req, res, next) => {
  const parsedParams = userPlaceIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid saved place id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const service = tryCreatePlacesServiceFromRequestOr503(req, res);
    if (!service) return;
    const data = await service.getSavedPlace(ownerUserId, parsedParams.data.userPlaceId);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});
