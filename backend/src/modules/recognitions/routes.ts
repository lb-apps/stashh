import { Router } from "express";
import { createSupabaseClientForRequest } from "../../db/supabaseClient.js";
import { sendAccepted, sendError, sendSuccess } from "../../http/response.js";
import { RecognitionRepository } from "./repository.js";
import { RecognitionService } from "./service.js";
import {
  createRecognitionRequestSchema,
  recognitionIdentifierSchema,
  recognitionResultQuerySchema,
} from "./types.js";

export const recognitionsRouter = Router();

recognitionsRouter.get("/result", async (req, res, next) => {
  const idRaw = req.query.id;
  const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;
  const parsedQuery = recognitionResultQuerySchema.safeParse({ id });
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
    const supabaseClient = createSupabaseClientForRequest(req);
    const recognitionService = new RecognitionService(
      new RecognitionRepository(supabaseClient),
    );
    const result = await recognitionService.getRecognitionResultForOwner(
      parsedQuery.data.id,
      ownerUserId,
    );
    if (!result) {
      sendError(res, req, 404, "NOT_FOUND", "Recognition result not found");
      return;
    }

    sendSuccess(res, req, 200, {
      result_id: result.id,
      normalized_source_url: result.normalized_source_url,
      items: result.items,
      created_at: result.created_at,
      updated_at: result.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

recognitionsRouter.post("/", async (req, res, next) => {
  const parsedBody = createRecognitionRequestSchema.safeParse(req.body);
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
    const supabaseClient = createSupabaseClientForRequest(req);
    const recognitionService = new RecognitionService(
      new RecognitionRepository(supabaseClient),
    );

    const recognition = await recognitionService.enqueueRecognition({
      ownerUserId,
      sourceUrl: parsedBody.data.source_url,
    });

    sendAccepted(res, req, {
      recognition_id: recognition.id,
      status: recognition.status,
      created_at: recognition.created_at,
    });
  } catch (error) {
    next(error);
  }
});

recognitionsRouter.get("/:id", async (req, res, next) => {
  const parsedParameters = recognitionIdentifierSchema.safeParse(req.params);
  if (!parsedParameters.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid recognition id", parsedParameters.error.flatten().fieldErrors);
    return;
  }

  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  try {
    const supabaseClient = createSupabaseClientForRequest(req);
    const recognitionService = new RecognitionService(
      new RecognitionRepository(supabaseClient),
    );

    const recognitionData = await recognitionService.getRecognition(
      parsedParameters.data.id,
      ownerUserId,
    );
    if (!recognitionData) {
      sendError(res, req, 404, "NOT_FOUND", "Recognition not found");
      return;
    }
    const { task: recognition, items } = recognitionData;

    sendSuccess(res, req, 200, {
      recognition_id: recognition.id,
      status: recognition.status,
      source_url: recognition.source_url,
      result_id: recognition.result_id,
      items,
      error_message: recognition.error_message,
      retry_count: recognition.retry_count,
      started_at: recognition.started_at,
      finished_at: recognition.finished_at,
      created_at: recognition.created_at,
      updated_at: recognition.updated_at,
    });
  } catch (error) {
    next(error);
  }
});

recognitionsRouter.post("/:id/commit", async (req, res, next) => {
  const parsedParameters = recognitionIdentifierSchema.safeParse(req.params);
  if (!parsedParameters.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid recognition id", parsedParameters.error.flatten().fieldErrors);
    return;
  }

  const ownerUserId = req.user?.sub;
  if (!ownerUserId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  try {
    const supabaseClient = createSupabaseClientForRequest(req);
    const recognitionService = new RecognitionService(
      new RecognitionRepository(supabaseClient),
    );
    const recognition = await recognitionService.commitRecognition(
      parsedParameters.data.id,
      ownerUserId,
    );

    if (!recognition) {
      sendError(res, req, 409, "CONFLICT", "Only completed recognitions can be committed");
      return;
    }

    sendSuccess(res, req, 200, {
      recognition_id: recognition.id,
      status: recognition.status,
      updated_at: recognition.updated_at,
    });
  } catch (error) {
    next(error);
  }
});
