import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
import { RecognitionRepository } from "./repository.js";
import { RecognitionService } from "./service.js";
import type { RecognitionTaskRow, RecognitionTaskOptions } from "./types.js";

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

  try {
    let cachedResultId: string | null = null;
    if (!taskOptions.bypass_cache) {
      cachedResultId = await tl.step("cache checked", async () => {
        const hit = await recognitionService.getCachedResultId(recognition.source_url);
        return { hit: Boolean(hit), resultId: hit } as { hit: boolean; resultId: string | null } & Record<string, unknown>;
      }).then((r) => r.resultId);
    }

    if (cachedResultId) {
      await tl.step("served from cache", async () => {
        await recognitionService.processRecognitionSuccess({
          recognitionId: recognition.id,
          resultId: cachedResultId,
        });
        return { resultId: cachedResultId };
      });
      tl.done();
      return;
    }

    const content = await tl.step("content fetched", async (stepLog) => {
      const result = await fetchSourceContent(recognition.source_url, stepLog);
      return { videoFound: true, captionLength: result.caption?.length ?? 0, _content: result };
    });
    const sourceContent = (content as Record<string, unknown>)["_content"] as Awaited<ReturnType<typeof fetchSourceContent>>;

    const analysis = await tl.step("video analyzed", async (stepLog) => {
      const result = await analyzeContent(
        sourceContent.video_url,
        sourceContent.caption,
        stepLog,
        sourceContent.platform,
      );
      return { placeCount: result.places.length, _analysis: result };
    });
    const analysisResult = (analysis as Record<string, unknown>)["_analysis"] as Awaited<ReturnType<typeof analyzeContent>>;

    const matchResult = await tl.step("places found", async () => {
      const matches = await matchPlaces(analysisResult.places, googlePlacesClient);
      const matchedCount = [...matches.values()].filter(Boolean).length;
      return { total: analysisResult.places.length, matched: matchedCount, _matches: matches };
    });
    const placeMatches = (matchResult as Record<string, unknown>)["_matches"] as Awaited<ReturnType<typeof matchPlaces>>;

    const matchedPlaces = analysisResult.places
      .filter((p) => Boolean(placeMatches.get(p.name)))
      .map((p) => placeMatches.get(p.name)!);

    const thumbnailUrls = await tl.step("thumbnails saved", async (stepLog) => {
      const supabase = createSupabaseServiceClient();
      const urls = new Map<string, string>();
      let saved = 0;
      let failed = 0;
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
            if (url) {
              urls.set(mp.google_place_id, url);
              saved++;
            }
          } catch {
            failed++;
          }
        }),
      );
      return { total: matchedPlaces.length, saved, failed, _urls: urls };
    });
    const urls = (thumbnailUrls as Record<string, unknown>)["_urls"] as Map<string, string>;

    const resultId = await tl.step("result saved", async () => {
      const extractedPlaces = analysisResult.places.map((place) => ({
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
        urls,
      );
      const id = await recognitionService.upsertRecognitionResult(
        recognition.source_url,
        places,
        sourceContent,
      );
      return { resultId: id, placeCount: places.length };
    });

    await recognitionService.processRecognitionSuccess({
      recognitionId: recognition.id,
      resultId: (resultId as Record<string, unknown>)["resultId"] as string,
    });

    tl.done();
  } catch (error) {
    tl.fail(error);
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

  const supabaseClient = createSupabaseServiceClient();
  const recognitionRepository = new RecognitionRepository(supabaseClient);
  const recognitionService = new RecognitionService(recognitionRepository);
  const googlePlacesClient = new GooglePlacesClient(config.GOOGLE_PLACES_API_KEY);
  const googlePhotoMediaClient = new GooglePhotoMediaClient(config.GOOGLE_PLACES_API_KEY);

  const realtimeClient = createSupabaseRealtimeClient();
  let realtimeChannel: ReturnType<typeof supabaseClient.channel> | null = null;

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
        const recoveredRecognitions = await recognitionRepository.recoverStaleRecognitions({
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
      const claimedRecognitions = await recognitionRepository.claimQueuedRecognitions({
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

  if (realtimeChannel) {
    await (realtimeClient ?? supabaseClient).removeChannel(realtimeChannel);
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
