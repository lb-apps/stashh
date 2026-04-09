import { Router, type Request, type Response } from "express";
import { sendError } from "../../http/response.js";

export const placesRouter = Router();

function notImplemented(req: Request, res: Response): void {
  sendError(res, req, 501, "NOT_IMPLEMENTED", "Places API is not implemented yet");
}

placesRouter.get("/", notImplemented);
placesRouter.get("/:placeId", notImplemented);
