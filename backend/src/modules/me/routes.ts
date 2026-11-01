import { Router } from "express";
import { sendError, sendSuccess } from "../../http/response.js";
import { createMeServiceFromRequest } from "./factory.js";

export const meRouter = Router();

meRouter.get("/", async (req, res, next) => {
  const userId = req.user?.sub;
  if (!userId) {
    sendError(res, req, 401, "UNAUTHORIZED", "Unauthorized");
    return;
  }

  try {
    sendSuccess(res, req, 200, await createMeServiceFromRequest(req).getMe(userId));
  } catch (error) {
    next(error);
  }
});
