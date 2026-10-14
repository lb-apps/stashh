import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseServiceClient, createSupabaseRealtimeClient } from "../../db/supabaseClient.js";
import { config } from "../../config.js";
import { rootLogger, type Logger } from "../../lib/logger.js";
import { createTaskLogger } from "./task-logger.js";
import { fetchSourceContent } from "./source-content.js";
import { analyzeContent } from "./ai-analyzer.js";
import { matchPlaces } from "./place-text-search.js";
import { GooglePlacesClient } from "../../services/google/google-places-client.js";
import { GooglePhotoMediaClient } from "../../services/google/google-photo-media-client.js";
import { uploadPlaceThumbnail } from "../../lib/thumbnailUploader.js";
import { createRecognitionServiceWithServiceRole } from "./factory.js";
import { buildRunRecord } from "./run-record.js";
import type { RecognitionService } from "./service.js";
import type { RecognitionTaskRow, RecognitionTaskOptions } from "./types.js";
import type { AIAnalysisResult, SourceContent } from "../../types/schemas.js";
import { uploadSourceThumbnail } from "../../lib/sourceThumbnailUploader.js";

let shouldKeepRunning = true;
let wakeResolver: (() => void) | null = null;
let hasPendingWakeSignal = false;

function createWorkerIdentifier(): string {
  return randomUUID().slice(0, 8);
}

function wakeWorkerLoop(): void {
  hasPendingWakeSignal = true;
  if (!wakeResolver) return;
  wakeResolver();
  wakeResolver = null;
}

function isStandaloneWorker(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(entry) === resolve(fileURLToPath(import.meta.url));
}

const ownProcessSignals = isStandaloneWorker();

export function requestWorkerShutdown(): void {
  shouldKeepRunning = false;
  wakeWorkerLoop();
}

async function waitForWakeSignal(maximumWaitMilliseconds: number): Promise<void> {
  if (hasPendingWakeSignal) {
    hasPendingWakeSignal = false;
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      wakeResolver = null;
      resolve();
    }, maximumWaitMilliseconds);

    wakeResolver = () => {
      clearTimeout(timeout);
      resolve();
    };
  });

  hasPendingWakeSignal = false;
}

async function processRecognition(
  recognitionService: RecognitionService,
  recognition: RecognitionTaskRow,
  googlePlacesClient: GooglePlacesClient,
  googlePhotoMediaClient: GooglePhotoMediaClient,
  workerLog: Logger,
): Promise<void> {
  const taskOptions = (recognition.options ?? {}) as RecognitionTaskOptions;
  const tl = createTaskLogger(workerLog, {
    id: recognition.id,
    sourceUrl: recognition.source_url,
    retryCount: recognition.retry_count,
    bypassCache: Boolean(taskOptions.bypass_cache),
  });
  const attempt = recognition.retry_count + 1;
  // Kept outside the try so a run that fails after the model call still records its cost.
  let analyzed: AIAnalysisResult | undefined;
  let fetchMethod: SourceContent["fetch_method"] | undefined;

  try {
    const cachedResultId = taskOptions.bypass_cache
      ? null
      : await tl.step(
          "cache checked",
          () => recognitionService.getCachedResultId(recognition.source_url),
          (hit) => ({ hit: Boolean(hit), resultId: hit }),
        );

    if (cachedResultId) {
      await tl.step(
        "served from cache",
        () => recognitionService.processRecognitionSuccess({ recognitionId: recognition.id, resultId: cachedResultId }),
        () => ({ resultId: cachedResultId }),
      );
      tl.done();
      await recognitionService.recordRun(
        buildRunRecord({ taskId: recognition.id, attempt, outcome: "cache_hit", timings: tl.timings() }),
        tl.log,
      );
      return;
    }

    const sourceContent = await tl.step(
      "content fetched",
      (stepLog) => fetchSourceContent(recognition, stepLog),
      (content) => ({ method: content.fetch_method, captionLength: content.caption?.length ?? 0 }),
    );
    fetchMethod = sourceContent.fetch_method;

    // The cover is copied while the model works; it never fails the recognition.
    const sourceThumbnail = sourceContent.thumbnail_url
      ? uploadSourceThumbnail(sourceContent.thumbnail_url, recognition.source_url, createSupabaseServiceClient(), tl.log)
      : Promise.resolve(null);

    const analysis = await tl.step(
      "media analyzed",
      (stepLog) => analyzeContent(sourceContent.media_url, sourceContent.caption, stepLog, sourceContent.platform),
      (result) => ({ kind: result.media_kind, placeCount: result.places.length }),
    );
    analyzed = analysis;

    const placeMatches = await tl.step(
      "places found",
      () => matchPlaces(analysis.places, googlePlacesClient),
      (matches) => ({ total: analysis.places.length, matched: [...matches.values()].filter(Boolean).length }),
    );

    const matchedPlaces = analysis.places
      .map((p) => placeMatches.get(p.name))
      .filter((match): match is NonNullable<typeof match> => Boolean(match));

    const thumbnailUrls = await tl.step(
      "thumbnails saved",
      async (stepLog) => {
        const supabase = createSupabaseServiceClient();
        const urls = new Map<string, string>();
        await Promise.all(
          matchedPlaces.map(async (mp) => {
            if (!mp.first_photo_name) return;
            try {
              const url = await uploadPlaceThumbnail(
                mp.google_place_id,
                mp.first_photo_name,
                config.PLACE_THUMBNAILS_BUCKET,
                supabase,
                googlePhotoMediaClient,
                stepLog,
              );
              if (url) urls.set(mp.google_place_id, url);
            } catch (error) {
              // A missing thumbnail must not fail the recognition; the place still ships.
              stepLog.warn({ err: error, googlePlaceId: mp.google_place_id }, "thumbnail upload failed");
            }
          }),
        );
        return urls;
      },
      (urls) => ({ total: matchedPlaces.length, saved: urls.size, failed: matchedPlaces.length - urls.size }),
    );

    const resultId = await tl.step(
      "result saved",
      () => {
        const extractedPlaces = analysis.places.map((place) => ({
          raw_name: place.name,
          location_hint: place.location_hint,
          instagram_username: place.instagram_username,
          recommendations: place.recommendations,
          confidence_score: place.confidence_score,
          source: place.source,
          matched_place: placeMatches.get(place.name) ?? null,
        }));
        const places = recognitionService.mapPipelineResultToStoredPlaces(
          { status: "completed", source_url: recognition.source_url, source_content: sourceContent, extracted_places: extractedPlaces },
          thumbnailUrls,
        );
        return sourceThumbnail.then((thumbnailUrl) =>
          recognitionService.upsertRecognitionResult(recognition.source_url, places, sourceContent, analysis.media_kind, thumbnailUrl),
        );
      },
      (id) => ({ resultId: id }),
    );

    await recognitionService.processRecognitionSuccess({ recognitionId: recognition.id, resultId });

    tl.done();
    await recognitionService.recordRun(
      buildRunRecord({
        taskId: recognition.id,
        attempt,
        outcome: "completed",
        timings: tl.timings(),
        fetchMethod,
        analysis: { ...analysis, places_extracted: analysis.places.length },
        placesMatched: matchedPlaces.length,
      }),
      tl.log,
    );
  } catch (error) {
    tl.fail(error);
    await recognitionService.recordRun(
      buildRunRecord({
        taskId: recognition.id,
        attempt,
        outcome: "failed",
        timings: tl.timings(),
        fetchMethod,
        analysis: analyzed && { ...analyzed, places_extracted: analyzed.places.length },
        errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      }),
      tl.log,
    );
    await recognitionService.processRecognitionFailure({ recognition, error }, tl.log);
  }
}

async function runWorker(): Promise<void> {
  const workerIdentifier = createWorkerIdentifier();
  const workerLog: Logger = rootLogger.child({ worker: workerIdentifier });

  const workerConcurrency = config.RECOGNITIONS_WORKER_CONCURRENCY;
  const claimBatchSize = config.RECOGNITIONS_CLAIM_BATCH_SIZE;
  const pollMinimumMilliseconds = config.RECOGNITIONS_POLL_MIN_MS;
  const pollMaximumMilliseconds = config.RECOGNITIONS_POLL_MAX_MS;
  const claimTimeoutMilliseconds = config.RECOGNITIONS_CLAIM_TIMEOUT_MS;
  const recoveryScanIntervalMilliseconds = config.RECOGNITIONS_RECOVERY_SCAN_INTERVAL_MS;

  const recognitionService = createRecognitionServiceWithServiceRole();
  const googlePlacesClient = new GooglePlacesClient(config.GOOGLE_PLACES_API_KEY);
  const googlePhotoMediaClient = new GooglePhotoMediaClient(config.GOOGLE_PLACES_API_KEY);

  const realtimeClient = createSupabaseRealtimeClient();
  let realtimeChannel: RealtimeChannel | null = null;

  if (realtimeClient) {
    realtimeChannel = realtimeClient
      .channel(`recognitions-worker-${workerIdentifier}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recognition_tasks" },
        () => wakeWorkerLoop(),
      )
      .subscribe((status, err) => {
        workerLog.info({ status, err: err?.message }, "realtime");
      });
  } else {
    workerLog.warn("realtime disabled — no publishable key, poll only");
  }

  workerLog.info({ concurrency: workerConcurrency }, "started");

  let nextRecoveryScanAtMilliseconds = Date.now();
  const inFlightTasks = new Set<Promise<void>>();

  function trackInFlightTask(task: Promise<void>): void {
    inFlightTasks.add(task);
    task.finally(() => {
      inFlightTasks.delete(task);
      wakeWorkerLoop();
    });
  }

  while (shouldKeepRunning) {
    try {
      if (Date.now() >= nextRecoveryScanAtMilliseconds) {
        const recoveredRecognitions = await recognitionService.recoverStaleRecognitions({
          staleAfterMilliseconds: claimTimeoutMilliseconds,
          claimBatchSize,
        });
        if (recoveredRecognitions.length > 0) {
          workerLog.info({ count: recoveredRecognitions.length }, "stale tasks recovered");
        }
        nextRecoveryScanAtMilliseconds = Date.now() + recoveryScanIntervalMilliseconds;
      }

      const availableCapacity = workerConcurrency - inFlightTasks.size;
      if (availableCapacity <= 0) {
        await waitForWakeSignal(pollMaximumMilliseconds);
        continue;
      }

      const claimLimit = Math.max(1, Math.min(claimBatchSize, availableCapacity));
      const claimedRecognitions = await recognitionService.claimQueuedRecognitions({
        workerIdentifier,
        claimBatchSize: claimLimit,
      });

      if (claimedRecognitions.length === 0) {
        await waitForWakeSignal(pollMaximumMilliseconds);
        continue;
      }

      workerLog.info(
        { count: claimedRecognitions.length, taskIds: claimedRecognitions.map((r) => r.id) },
        "tasks claimed",
      );
      for (const recognition of claimedRecognitions) {
        if (!shouldKeepRunning) break;
        trackInFlightTask(
          processRecognition(recognitionService, recognition, googlePlacesClient, googlePhotoMediaClient, workerLog),
        );
      }
    } catch (error) {
      workerLog.error({ err: error }, "loop error");
      await waitForWakeSignal(pollMinimumMilliseconds);
    }
  }

  if (inFlightTasks.size > 0) {
    await Promise.allSettled(Array.from(inFlightTasks));
  }

  if (realtimeClient && realtimeChannel) {
    await realtimeClient.removeChannel(realtimeChannel);
  }
  workerLog.info("shutdown complete");
}

if (ownProcessSignals) {
  process.on("SIGTERM", () => requestWorkerShutdown());
  process.on("SIGINT", () => requestWorkerShutdown());
}

void runWorker().catch((error) => {
  rootLogger.fatal({ err: error }, "worker fatal error");
  process.exit(1);
});
