import { config } from "../../config.js";
import type { Logger } from "../../lib/logger.js";
import type { Json } from "../../types/database.js";
import type { RecognitionPipelineResponse, MatchedPlace, VenueRecommendation, SourceContent } from "../../types/schemas.js";
import type { RecognitionRepository } from "./repository.js";
import type { RecognitionRunInsert } from "./run-record.js";
import type {
  RecognitionResultRow,
  RecognitionSource,
  RecognitionTaskOptions,
  RecognitionTaskRow,
  SharedMediaFormat,
} from "./types.js";

interface RecognitionBackoffResult {
  retryCount: number;
  delayMilliseconds: number;
}

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function normalizeInstagramSourceUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.protocol = "https:";
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.pathname = stripTrailingSlash(parsed.pathname);
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

/** Result-cache key of a post or story shared in an Instagram DM, which has no URL. */
function instagramMediaKey(format: SharedMediaFormat, mediaId: string): string {
  return format === "story" ? `instagram-story:${mediaId}` : `instagram-media:${mediaId}`;
}

interface EnqueueRecognitionParams {
  ownerUserId: string;
  source: RecognitionSource;
  options?: RecognitionTaskOptions;
  /**
   * Caller-supplied key (e.g. the channel's message id). A repeat with the same key
   * for the same owner returns the original task instead of creating a second one.
   */
  idempotencyKey?: string;
}

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === UNIQUE_VIOLATION;
}

interface ProcessRecognitionSuccessParams {
  recognitionId: string;
  resultId: string;
}

interface ProcessRecognitionFailureParams {
  recognition: RecognitionTaskRow;
  error: unknown;
}

const MINIMUM_BACKOFF_MILLISECONDS = 1_000;
const MAXIMUM_BACKOFF_MILLISECONDS = 60_000;

export interface RecognitionResultPlace {
  google_place_id: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  thumbnail_url: string | null;
  instagram_username: string | null;
  recommendations: VenueRecommendation[];
}

function normalizeErrorMessage(error: unknown): string {
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
    ].filter((v): v is string => typeof v === "string" && v.length > 0);
    if (parts.length > 0) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return "[unserializable error object]";
    }
  }
  return "Unexpected recognition processing error";
}

export function calculateRetryBackoff(
  currentRetryCount: number,
): RecognitionBackoffResult {
  const retryCount = currentRetryCount + 1;
  const exponentialDelay = MINIMUM_BACKOFF_MILLISECONDS * (2 ** (retryCount - 1));
  const delayMilliseconds = Math.min(exponentialDelay, MAXIMUM_BACKOFF_MILLISECONDS);
  return {
    retryCount,
    delayMilliseconds,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class RecognitionService {
  constructor(private readonly recognitionRepository: RecognitionRepository) {}

  async enqueueRecognition(params: EnqueueRecognitionParams): Promise<RecognitionTaskRow> {
    const { source } = params;
    const sourceUrl = source.kind === "url" ? normalizeInstagramSourceUrl(source.url) : instagramMediaKey(source.format, source.mediaId);
    const sourceMedia =
      source.kind === "shared_media"
        ? { media_url: source.mediaUrl, caption: source.caption, platform: source.provider, source_type: source.format }
        : null;
    const options = params.options ?? {};
    const { idempotencyKey } = params;

    if (idempotencyKey) {
      const existing = await this.recognitionRepository.getRecognitionByIdempotencyKey(params.ownerUserId, idempotencyKey);
      if (existing) return existing;
    }

    try {
      return await this.recognitionRepository.createQueuedRecognition({
        owner_user_id: params.ownerUserId,
        source_url: sourceUrl,
        status: "queued",
        retry_count: 0,
        options: options as Json,
        idempotency_key: idempotencyKey ?? null,
        source_media: sourceMedia,
      });
    } catch (error) {
      // Lost a race with a concurrent request carrying the same key: return the winner.
      if (idempotencyKey && isUniqueViolation(error)) {
        const winner = await this.recognitionRepository.getRecognitionByIdempotencyKey(params.ownerUserId, idempotencyKey);
        if (winner) return winner;
      }
      throw error;
    }
  }

  async getRecognition(
    recognitionId: string,
    ownerUserId: string,
  ): Promise<{ task: RecognitionTaskRow; places: Json | null } | null> {
    return this.recognitionRepository.getRecognitionByIdForOwner(recognitionId, ownerUserId);
  }

  async getRecognitionResultForOwner(
    resultId: string,
    ownerUserId: string,
  ): Promise<RecognitionResultRow | null> {
    return this.recognitionRepository.getRecognitionResultByIdForOwner(resultId, ownerUserId);
  }

  async commitRecognition(
    recognitionId: string,
    ownerUserId: string,
  ): Promise<RecognitionTaskRow | null> {
    return this.recognitionRepository.markRecognitionCommitted(recognitionId, ownerUserId);
  }

  /** Atomically claims queued tasks for this worker (`FOR UPDATE SKIP LOCKED`). */
  async claimQueuedRecognitions(
    params: Parameters<RecognitionRepository["claimQueuedRecognitions"]>[0],
  ): Promise<RecognitionTaskRow[]> {
    return this.recognitionRepository.claimQueuedRecognitions(params);
  }

  /** Requeues tasks whose worker stopped heartbeating past the claim timeout. */
  async recoverStaleRecognitions(
    params: Parameters<RecognitionRepository["recoverStaleRecognitions"]>[0],
  ): Promise<RecognitionTaskRow[]> {
    return this.recognitionRepository.recoverStaleRecognitions(params);
  }

  async getCachedResultId(sourceUrl: string): Promise<string | null> {
    const cachedResult = await this.recognitionRepository.getRecognitionResultBySourceUrl(sourceUrl);
    return cachedResult?.id ?? null;
  }

  mapPipelineResultToStoredPlaces(
    result: RecognitionPipelineResponse,
    thumbnailUrls: Map<string, string>,
  ): RecognitionResultPlace[] {
    return result.extracted_places
      .filter((entry): entry is typeof entry & { matched_place: MatchedPlace } => Boolean(entry.matched_place))
      .map((entry) => {
        const { matched_place } = entry;
        const { first_photo_name: _, ...place } = matched_place;
        return {
          ...place,
          thumbnail_url: thumbnailUrls.get(place.google_place_id) ?? null,
          instagram_username: entry.instagram_username,
          recommendations: entry.recommendations,
        };
      });
  }

  async upsertRecognitionResult(
    sourceUrl: string,
    places: RecognitionResultPlace[],
    sourceContent: SourceContent,
    /** The first video the model read; null for a photo post or carousel of photos. */
    videoUrl: string | null,
    sourceThumbnailUrl: string | null,
  ): Promise<string> {
    const result = await this.recognitionRepository.upsertRecognitionResult({
      sourceUrl,
      places: places as unknown as Json,
      videoUrl,
      caption: sourceContent.caption,
      sourceType: sourceContent.source_type,
      sourceThumbnailUrl,
    });
    return result.id;
  }

  /**
   * Records how one attempt went. Metrics are an observer: a failed write is logged
   * and swallowed so it can never fail or retry the recognition itself.
   */
  async recordRun(run: RecognitionRunInsert, log: Logger): Promise<void> {
    try {
      await this.recognitionRepository.insertRun(run);
    } catch (error) {
      log.warn({ err: error, outcome: run.outcome }, "recognition run not recorded");
    }
  }

  async processRecognitionSuccess(params: ProcessRecognitionSuccessParams): Promise<void> {
    await this.recognitionRepository.completeRecognition({
      recognitionId: params.recognitionId,
      resultId: params.resultId,
    });
  }

  async processRecognitionFailure(params: ProcessRecognitionFailureParams, log?: Logger): Promise<void> {
    const normalizedErrorMessage = normalizeErrorMessage(params.error);
    const nextRetryCount = params.recognition.retry_count + 1;

    if (nextRetryCount <= config.RECOGNITIONS_MAX_RETRIES) {
      const backoff = calculateRetryBackoff(params.recognition.retry_count);
      log?.warn(
        { retryCount: nextRetryCount, maxRetries: config.RECOGNITIONS_MAX_RETRIES, delayMs: backoff.delayMilliseconds, reason: normalizedErrorMessage },
        "retrying",
      );
      await delay(backoff.delayMilliseconds);
      await this.recognitionRepository.requeueRecognition({
        recognitionId: params.recognition.id,
        errorMessage: normalizedErrorMessage,
        backoff,
      });
      return;
    }

    log?.error(
      { retryCount: params.recognition.retry_count, maxRetries: config.RECOGNITIONS_MAX_RETRIES, reason: normalizedErrorMessage },
      "giving up",
    );
    await this.recognitionRepository.failRecognition({
      recognitionId: params.recognition.id,
      errorMessage: normalizedErrorMessage,
    });
  }
}
