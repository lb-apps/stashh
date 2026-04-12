import { config } from "../../config.js";
import type { Json } from "../../types/database.js";
import type { RecognitionPipelineResponse, MatchedPlace, VenueRecommendation } from "../../types/schemas.js";
import type { RecognitionRepository } from "./repository.js";
import type {
  RecognitionResultRow,
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

export interface RecognitionResultItem {
  /** First Google Places photo resource name; persist on user save only. */
  firstPhotoName: string | null;
  instagramUsername: string | null;
  recommendations: VenueRecommendation[];
  confidenceScore: number;
  place: Omit<MatchedPlace, "firstPhotoName">;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
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
    const normalizedSourceUrl = normalizeInstagramSourceUrl(params.sourceUrl);
    return this.recognitionRepository.createQueuedRecognition({
      owner_user_id: params.ownerUserId,
      source_url: params.sourceUrl,
      normalized_source_url: normalizedSourceUrl,
      status: "queued",
      retry_count: 0,
    });
  }

  async getRecognition(
    recognitionId: string,
    ownerUserId: string,
  ): Promise<{ task: RecognitionTaskRow; items: Json | null } | null> {
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

  async getCachedResultId(normalizedSourceUrl: string): Promise<string | null> {
    const cachedResult = await this.recognitionRepository.getRecognitionResultByNormalizedSourceUrl(
      normalizedSourceUrl,
    );
    return cachedResult?.id ?? null;
  }

  mapPipelineResultToStoredItems(result: RecognitionPipelineResponse): RecognitionResultItem[] {
    return result.extractedPlaces
      .filter((entry): entry is typeof entry & { matchedPlace: MatchedPlace } => Boolean(entry.matchedPlace))
      .map((entry) => {
        const { matchedPlace } = entry;
        const { firstPhotoName, ...place } = matchedPlace;
        return {
          firstPhotoName,
          instagramUsername: entry.instagramUsername,
          recommendations: entry.recommendations,
          confidenceScore: entry.confidenceScore,
          place,
        };
      });
  }

  async upsertRecognitionResult(
    normalizedSourceUrl: string,
    items: RecognitionResultItem[],
  ): Promise<string> {
    const result = await this.recognitionRepository.upsertRecognitionResult({
      normalizedSourceUrl,
      items: items as unknown as Json,
    });
    return result.id;
  }

  async processRecognitionSuccess(params: ProcessRecognitionSuccessParams): Promise<void> {
    await this.recognitionRepository.completeRecognition({
      recognitionId: params.recognitionId,
      resultId: params.resultId,
    });
  }

  async processRecognitionFailure(params: ProcessRecognitionFailureParams): Promise<void> {
    const normalizedErrorMessage = normalizeErrorMessage(params.error);
    const nextRetryCount = params.recognition.retry_count + 1;

    if (nextRetryCount <= config.RECOGNITIONS_MAX_RETRIES) {
      const backoff = calculateRetryBackoff(params.recognition.retry_count);
      await delay(backoff.delayMilliseconds);
      await this.recognitionRepository.requeueRecognition({
        recognitionId: params.recognition.id,
        errorMessage: normalizedErrorMessage,
        backoff,
      });
      return;
    }

    await this.recognitionRepository.failRecognition({
      recognitionId: params.recognition.id,
      errorMessage: normalizedErrorMessage,
    });
  }
}
