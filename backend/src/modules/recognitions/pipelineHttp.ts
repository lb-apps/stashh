import type { Router } from "express";
import {
  recognitionPipelineBodySchema,
  recognitionStreamQuerySchema,
  type RecognitionPipelineResponse,
} from "../../types/schemas.js";
import { runRecognitionPipeline } from "../../services/recognitionPipeline.js";
import { createRequestLogger } from "../../logger.js";
import { clientFacingErrorMessage } from "../../errors/clientMessage.js";
import { sendError, sendSuccess } from "../../http/response.js";

const DEBUG_TRACE = process.env["RECOGNITIONS_DEBUG_TRACE"] === "true";

/** SSE + sync JSON pipeline — register on the recognitions router before `/:id`. */
export function registerRecognitionPipelineHttp(router: Router): void {
  router.get("/stream", async (req, res) => {
    const parsedQuery = recognitionStreamQuerySchema.safeParse({ url: req.query.url });
    if (!parsedQuery.success) {
      sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request", parsedQuery.error.flatten().fieldErrors);
      return;
    }

    const { url: instagram_url } = parsedQuery.data;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const log = await createRequestLogger(instagram_url);
    const emit = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    const totalStart = Date.now();

    try {
      const result = await runRecognitionPipeline(instagram_url, {
        onStepEvent: (event) => {
          if (event.status === "running") {
            void log.info("step_start", { step: event.step });
            emit("step", { id: event.step, status: "running" });
            return;
          }

          void log.info("step_done", { step: event.step, duration: event.duration, ...event.meta });
          emit("step", {
            id: event.step,
            status: "done",
            duration: event.duration,
            meta: event.meta,
          });
        },
        onCaption: (caption) => {
          if (caption) emit("caption", { text: caption });
        },
      });

      const totalDuration = Date.now() - totalStart;
      await log.done({
        totalDuration,
        placeCount: result.extractedPlaces.length,
        requestId: log.requestId,
      });

      emit("result", result);
      emit("done", { totalDuration, requestId: log.requestId });
    } catch (error) {
      const totalDuration = Date.now() - totalStart;
      await log.error("request_failed", error, { totalDuration });
      console.error(`[recognitions/stream] [${log.requestId}] Error:`, error);
      emit("error", {
        message: clientFacingErrorMessage(error),
        requestId: log.requestId,
      });
    }

    res.end();
  });

  router.post("/pipeline", async (req, res) => {
    const parsed = recognitionPipelineBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, req, 400, "VALIDATION_ERROR", "Invalid request body", parsed.error.flatten().fieldErrors);
      return;
    }

    const { instagram_url } = parsed.data;
    const log = await createRequestLogger(instagram_url);
    const totalStart = Date.now();
    if (DEBUG_TRACE) {
      console.log(`[recognitions:trace] pipeline.request url=${instagram_url} requestId=${log.requestId}`);
    }

    try {
      const result = await runRecognitionPipeline(instagram_url, {
        onStepEvent: (event) => {
          if (DEBUG_TRACE) {
            console.log("[recognitions:trace] pipeline.step", event);
          }
          if (event.status === "running") {
            void log.info("step_start", { step: event.step });
            return;
          }

          void log.info("step_done", { step: event.step, duration: event.duration, ...event.meta });
        },
      });

      const totalDuration = Date.now() - totalStart;
      await log.done({ totalDuration, placeCount: result.extractedPlaces.length });
      if (DEBUG_TRACE) {
        console.log("[recognitions:trace] pipeline.result.extractedPlaces", result.extractedPlaces.map((p) => ({
          rawName: p.rawName,
          instagramUsername: p.instagramUsername,
          source: p.source,
          matched: Boolean(p.matchedPlace),
        })));
      }
      sendSuccess(res, req, 200, result as RecognitionPipelineResponse);
    } catch (error) {
      await log.error("request_failed", error, { totalDuration: Date.now() - totalStart });
      console.error(`[recognitions/pipeline] [${log.requestId}] Error:`, error);
      sendError(res, req, 500, "INTERNAL", clientFacingErrorMessage(error), { request_id: log.requestId });
    }
  });
}
