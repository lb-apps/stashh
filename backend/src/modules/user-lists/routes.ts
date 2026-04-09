import { Router } from "express";
import { createSupabaseClientForRequest } from "../../db/supabaseClient.js";
import { sendCreated, sendError, sendSuccess } from "../../http/response.js";
import { UserListsRepository } from "./repository.js";
import { UserListsService } from "./service.js";
import {
  addListPlaceBodySchema,
  createListBodySchema,
  listIdParamsSchema,
  listPlaceParamsSchema,
  listPlacesQuerySchema,
  patchListBodySchema,
} from "./types.js";

export const userListsRouter = Router();

userListsRouter.get("/", async (req, res, next) => {
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.listLists(ownerUserId);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});

userListsRouter.post("/", async (req, res, next) => {
  const parsed = createListBodySchema.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.createList(ownerUserId, parsed.data);
    sendCreated(res, req, data);
  } catch (err) {
    next(err);
  }
});

userListsRouter.get("/:listId/places", async (req, res, next) => {
  const parsedParams = listIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid list id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const parsedQuery = listPlacesQuerySchema.safeParse({
    limit: req.query["limit"],
    cursor: typeof req.query["cursor"] === "string" ? req.query["cursor"] : undefined,
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
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const result = await service.listPlaces(ownerUserId, parsedParams.data.listId, parsedQuery.data);
    sendSuccess(res, req, 200, result.data, result.pagination);
  } catch (err) {
    next(err);
  }
});

userListsRouter.post("/:listId/places", async (req, res, next) => {
  const parsedParams = listIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid list id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const parsedBody = addListPlaceBodySchema.safeParse(req.body);
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
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.addPlace(ownerUserId, parsedParams.data.listId, parsedBody.data);
    sendCreated(res, req, data);
  } catch (err) {
    next(err);
  }
});

userListsRouter.delete("/:listId/places/:listPlaceId", async (req, res, next) => {
  const parsedParams = listPlaceParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid parameters", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.removePlace(
      ownerUserId,
      parsedParams.data.listId,
      parsedParams.data.listPlaceId,
    );
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});

userListsRouter.get("/:listId", async (req, res, next) => {
  const parsedParams = listIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid list id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.getList(ownerUserId, parsedParams.data.listId);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});

userListsRouter.patch("/:listId", async (req, res, next) => {
  const parsedParams = listIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid list id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const parsedBody = patchListBodySchema.safeParse(req.body);
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
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.updateList(ownerUserId, parsedParams.data.listId, parsedBody.data);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});

userListsRouter.delete("/:listId", async (req, res, next) => {
  const parsedParams = listIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid list id", parsedParams.error.flatten().fieldErrors);
    return;
  }
  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }
  try {
    const supabase = createSupabaseClientForRequest(req);
    const service = new UserListsService(new UserListsRepository(supabase));
    const data = await service.deleteList(ownerUserId, parsedParams.data.listId);
    sendSuccess(res, req, 200, data);
  } catch (err) {
    next(err);
  }
});
