import { randomUUID } from "node:crypto";
import { Client as PgClient } from "pg";
import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { config } from "../../config.js";
import { runRecognitionPipeline } from "../../services/recognitionPipeline.js";
import { RecognitionRepository } from "./repository.js";
import { RecognitionService } from "./service.js";
import type { RecognitionTaskRow } from "./types.js";

let shouldKeepRunning = true;
let wakeResolver: (() => void) | null = null;
let hasPendingWakeSignal = false;

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    const parts = [
      candidate.message,
      candidate.code,
      candidate.details,
      candidate.hint,
    ]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length > 0) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return "[unserializable error object]";
    }
  }
  return "Unexpected unknown error";
}

function createWorkerIdentifier(): string {
  return `recognitions-worker-${randomUUID().slice(0, 8)}`;
}

function wakeWorkerLoop(): void {
  hasPendingWakeSignal = true;
  if (!wakeResolver) return;
  wakeResolver();
  wakeResolver = null;
}

const ownProcessSignals = process.env["APP_ROLE"]?.toLowerCase() !== "combined";

export function requestWorkerShutdown(): void {
  console.log("[recognitions-worker] shutdown requested");
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
): Promise<void> {
  try {
    let cachedResultId: string | null = null;
    if (!config.RECOGNITIONS_BYPASS_RESULT_CACHE) {
      cachedResultId = await recognitionService.getCachedResultId(recognition.normalized_source_url);
    }
    if (cachedResultId) {
      await recognitionService.processRecognitionSuccess({
        recognitionId: recognition.id,
        resultId: cachedResultId,
      });
      console.log(
        `[recognitions-worker] cache hit recognition=${recognition.id} url=${recognition.normalized_source_url} result=${cachedResultId}`,
      );
      return;
    }

    const extractionResult = await runRecognitionPipeline(recognition.source_url);
    const items = recognitionService.mapPipelineResultToStoredItems(extractionResult);
    const resultId = await recognitionService.upsertRecognitionResult(
      recognition.normalized_source_url,
      items,
    );
    await recognitionService.processRecognitionSuccess({
      recognitionId: recognition.id,
      resultId,
    });
    console.log(`[recognitions-worker] completed ${recognition.id}`);
  } catch (error) {
    await recognitionService.processRecognitionFailure({ recognition, error });
    const errorMessage = formatUnknownError(error);
    console.error(`[recognitions-worker] failed ${recognition.id}: ${errorMessage}`);
  }
}

async function runWorker(): Promise<void> {
  const workerIdentifier = createWorkerIdentifier();
  const workerConcurrency = config.RECOGNITIONS_WORKER_CONCURRENCY;
  const claimBatchSize = config.RECOGNITIONS_CLAIM_BATCH_SIZE;
  const pollMinimumMilliseconds = config.RECOGNITIONS_POLL_MIN_MS;
  const pollMaximumMilliseconds = config.RECOGNITIONS_POLL_MAX_MS;
  const claimTimeoutMilliseconds = config.RECOGNITIONS_CLAIM_TIMEOUT_MS;
  const recoveryScanIntervalMilliseconds =
    config.RECOGNITIONS_RECOVERY_SCAN_INTERVAL_MS;

  const supabaseClient = createSupabaseServiceClient();
  const recognitionRepository = new RecognitionRepository(supabaseClient);
  const recognitionService = new RecognitionService(recognitionRepository);

  const realtimeChannel = supabaseClient
    .channel(`recognitions-worker-${workerIdentifier}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "recognition_tasks",
      },
      () => wakeWorkerLoop(),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[recognitions-worker] realtime subscription active");
      }
    });

  let pgWakeClient: PgClient | null = null;
  if (config.SUPABASE_DB_URL) {
    try {
      pgWakeClient = new PgClient({ connectionString: config.SUPABASE_DB_URL });
      await pgWakeClient.connect();
      pgWakeClient.on("notification", (message: { channel?: string }) => {
        if (message.channel === "recognition_queue_wakeup") {
          wakeWorkerLoop();
        }
      });
      pgWakeClient.on("error", (error: unknown) => {
        const errorMessage = formatUnknownError(error);
        console.error(`[recognitions-worker] pg listener error: ${errorMessage}`);
      });
      await pgWakeClient.query("LISTEN recognition_queue_wakeup");
      console.log("[recognitions-worker] postgres LISTEN active (recognition_queue_wakeup)");
    } catch (error) {
      const errorMessage = formatUnknownError(error);
      console.error(
        `[recognitions-worker] failed to start postgres LISTEN; using realtime+poll only: ${errorMessage}`,
      );
      try {
        await pgWakeClient?.end();
      } catch {
        // no-op: best effort cleanup on failed initialization
      }
      pgWakeClient = null;
    }
  }

  console.log(
    `[recognitions-worker] started worker=${workerIdentifier} batch=${claimBatchSize} concurrency=${workerConcurrency} bypassResultCache=${config.RECOGNITIONS_BYPASS_RESULT_CACHE}`,
  );

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
        // Safety-net recovery for missed events or interrupted workers.
        const recoveredRecognitions =
          await recognitionRepository.recoverStaleRecognitions({
            staleAfterMilliseconds: claimTimeoutMilliseconds,
            claimBatchSize,
          });
        if (recoveredRecognitions.length > 0) {
          console.log(
            `[recognitions-worker] recovered ${recoveredRecognitions.length} stale recognitions`,
          );
        }
        nextRecoveryScanAtMilliseconds =
          Date.now() + recoveryScanIntervalMilliseconds;
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

      for (const recognition of claimedRecognitions) {
        if (!shouldKeepRunning) {
          break;
        }
        trackInFlightTask(processRecognition(recognitionService, recognition));
      }
    } catch (error) {
      const errorMessage = formatUnknownError(error);
      console.error(`[recognitions-worker] loop error: ${errorMessage}`);
      await waitForWakeSignal(pollMinimumMilliseconds);
    }
  }

  if (inFlightTasks.size > 0) {
    await Promise.allSettled(Array.from(inFlightTasks));
  }

  if (pgWakeClient) {
    try {
      await pgWakeClient.query("UNLISTEN recognition_queue_wakeup");
    } catch {
      // no-op: shutdown should continue even if unlisten fails
    }
    await pgWakeClient.end().catch(() => undefined);
  }

  await supabaseClient.removeChannel(realtimeChannel);
  console.log("[recognitions-worker] shutdown complete");
}

if (ownProcessSignals) {
  process.on("SIGTERM", () => {
    console.log("[recognitions-worker] SIGTERM received");
    requestWorkerShutdown();
  });

  process.on("SIGINT", () => {
    console.log("[recognitions-worker] SIGINT received");
    requestWorkerShutdown();
  });
}

void runWorker().catch((error) => {
  const errorMessage = formatUnknownError(error);
  console.error(`[recognitions-worker] fatal error: ${errorMessage}`);
  process.exit(1);
});
