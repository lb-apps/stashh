import { Router, type Request, type Response } from "express";
import { sendError } from "../../http/response.js";

export const userPlacesRouter = Router();

function notImplemented(req: Request, res: Response): void {
  sendError(res, req, 501, "NOT_IMPLEMENTED", "User places API is not implemented yet");
}

userPlacesRouter.get("/", notImplemented);
userPlacesRouter.post("/", notImplemented);
userPlacesRouter.get("/:userPlaceId", notImplemented);
