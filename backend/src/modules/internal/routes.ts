import { Router } from "express";
import { z } from "zod";
import { sendAccepted, sendError, sendNoContent, sendSuccess } from "../../http/response.js";
import { createChannelIdentityService } from "../identities/factory.js";
import { channelIdentityParamsSchema } from "../identities/types.js";
import { createRecognitionServiceWithServiceRole } from "../recognitions/factory.js";
import { presentAcceptedRecognition, presentRecognition } from "../recognitions/presenter.js";
import { createInternalRecognitionRequestSchema, toRecognitionSource } from "../recognitions/types.js";

/**
 * Service-to-service API for trusted channel adapters (the Instagram DM service).
 *
 * Mounted behind service-token auth, never user JWTs. Runs with the service-role
 * database client, so every recognition route is scoped by the `userId` in its path —
 * the same owner filter the public API derives from the JWT.
 */
export const internalRouter = Router();

const userParamsSchema = z.object({ userId: z.string().uuid("userId must be a UUID") });
const userRecognitionParamsSchema = userParamsSchema.extend({
  id: z.string().uuid("Recognition id must be a UUID"),
});
const idempotencyKeySchema = z.string().trim().min(1).max(255);

// ── Channel identities ──────────────────────────────────────────────────────

/** Resolve-or-create the Stashh user behind a channel identity. Idempotent. */
internalRouter.put("/channel-identities/:provider/:externalId", async (req, res, next) => {
  const params = channelIdentityParamsSchema.safeParse(req.params);
  if (!params.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid channel identity", params.error.flatten().fieldErrors);
    return;
  }

  try {
    const identity = await createChannelIdentityService().resolve(params.data.provider, params.data.externalId);
    sendSuccess(res, req, identity.created ? 201 : 200, {
      provider: identity.provider,
      external_id: identity.externalId,
      user_id: identity.userId,
      created: identity.created,
    });
  } catch (error) {
    next(error);
  }
});

/** Erase the user behind a channel identity and everything they own. Idempotent. */
internalRouter.delete("/channel-identities/:provider/:externalId", async (req, res, next) => {
  const params = channelIdentityParamsSchema.safeParse(req.params);
  if (!params.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid channel identity", params.error.flatten().fieldErrors);
    return;
  }

  try {
    await createChannelIdentityService().erase(params.data.provider, params.data.externalId);
    sendNoContent(res);
  } catch (error) {
    next(error);
  }
});

// ── Recognitions on behalf of a user ────────────────────────────────────────

internalRouter.post("/users/:userId/recognitions", async (req, res, next) => {
  const params = userParamsSchema.safeParse(req.params);
  const body = createInternalRecognitionRequestSchema.safeParse(req.body);
  const rawKey = req.get("idempotency-key");
  const idempotencyKey = rawKey === undefined ? undefined : idempotencyKeySchema.safeParse(rawKey);

  if (!params.success || !body.success || idempotencyKey?.success === false) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request", {
      ...(params.success ? {} : params.error.flatten().fieldErrors),
      ...(body.success ? {} : body.error.flatten().fieldErrors),
      ...(idempotencyKey?.success === false ? { "Idempotency-Key": ["Must be 1–255 characters"] } : {}),
    });
    return;
  }

  try {
    const task = await createRecognitionServiceWithServiceRole().enqueueRecognition({
      ownerUserId: params.data.userId,
      source: toRecognitionSource(body.data),
      idempotencyKey: idempotencyKey?.data,
    });
    sendAccepted(res, req, presentAcceptedRecognition(task));
  } catch (error) {
    next(error);
  }
});

internalRouter.get("/users/:userId/recognitions/:id", async (req, res, next) => {
  const params = userRecognitionParamsSchema.safeParse(req.params);
  if (!params.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid path", params.error.flatten().fieldErrors);
    return;
  }

  try {
    const recognition = await createRecognitionServiceWithServiceRole().getRecognition(
      params.data.id,
      params.data.userId,
    );
    if (!recognition) {
      sendError(res, req, 404, "NOT_FOUND", "Recognition not found");
      return;
    }
    sendSuccess(res, req, 200, presentRecognition(recognition.task, recognition.places));
  } catch (error) {
    next(error);
  }
});
