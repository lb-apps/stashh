import { Router } from "express";
import { sendAccepted, sendError, sendSuccess } from "../../http/response.js";
import { createRecognitionServiceForRequest } from "./factory.js";
import { presentAcceptedRecognition, presentRecognition } from "./presenter.js";
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
    const recognitionService = createRecognitionServiceForRequest(req);
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
      source_url: result.source_url,
      video_url: result.video_url,
      caption: result.caption,
      source_type: result.source_type,
      places: result.places,
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
    const recognitionService = createRecognitionServiceForRequest(req);

    const recognition = await recognitionService.enqueueRecognition({
      ownerUserId,
      source: { kind: "url", url: parsedBody.data.source_url },
      options: {
        bypass_cache: req.headers["x-bypass-cache"] === "true",
      },
    });

    sendAccepted(res, req, presentAcceptedRecognition(recognition));
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
    const recognitionService = createRecognitionServiceForRequest(req);

    const recognitionData = await recognitionService.getRecognition(
      parsedParameters.data.id,
      ownerUserId,
    );
    if (!recognitionData) {
      sendError(res, req, 404, "NOT_FOUND", "Recognition not found");
      return;
    }
    sendSuccess(res, req, 200, presentRecognition(recognitionData));
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
    const recognitionService = createRecognitionServiceForRequest(req);
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
