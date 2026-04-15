import { config } from "../../config.js";
import type { Logger } from "../../lib/logger.js";
import type { Json } from "../../types/database.js";
import type { RecognitionPipelineResponse, MatchedPlace, VenueRecommendation, InstagramContent } from "../../types/schemas.js";
import type { RecognitionRepository } from "./repository.js";
import type {
  RecognitionResultRow,
  RecognitionTaskOptions,
  RecognitionTaskRow,
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

interface EnqueueRecognitionParams {
  ownerUserId: string;
  sourceUrl: string;
  options?: RecognitionTaskOptions;
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
    const sourceUrl = normalizeInstagramSourceUrl(params.sourceUrl);
    const options = params.options ?? {};
    return this.recognitionRepository.createQueuedRecognition({
      owner_user_id: params.ownerUserId,
      source_url: sourceUrl,
      status: "queued",
      retry_count: 0,
      options: options as Json,
    });
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
    instagramContent: InstagramContent,
  ): Promise<string> {
    const result = await this.recognitionRepository.upsertRecognitionResult({
      sourceUrl,
      places: places as unknown as Json,
      videoUrl: instagramContent.video_url,
      caption: instagramContent.caption,
      sourceType: instagramContent.source_type,
    });
    return result.id;
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
