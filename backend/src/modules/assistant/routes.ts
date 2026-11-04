import { Router } from "express";
import { z } from "zod";
import { sendError, sendSuccess } from "../../http/response.js";
import { createAssistantService } from "./factory.js";
import { assistantTurnBodySchema } from "./types.js";

const userParamsSchema = z.object({ userId: z.string().uuid("userId must be a UUID") });

/**
 * `/internal/v1/users/:userId/assistant` — one conversational turn for a channel user. Mounted
 * behind the service token; the owner is the `userId` in the path, as for every internal route.
 */
export const assistantRouter = Router({ mergeParams: true });

assistantRouter.post("/turns", async (req, res, next) => {
  const params = userParamsSchema.safeParse(req.params);
  const body = assistantTurnBodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request", {
      ...(params.success ? {} : params.error.flatten().fieldErrors),
      ...(body.success ? {} : body.error.flatten().fieldErrors),
    });
    return;
  }

  try {
    const plan = await createAssistantService().turn({ userId: params.data.userId, channel: body.data.channel, messages: body.data.messages });
    sendSuccess(res, req, 200, plan);
  } catch (error) {
    next(error);
  }
});
