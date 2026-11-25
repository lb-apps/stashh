import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "../../types/database.js";
import { recognitionQuotaSchema, type RecognitionQuota } from "../billing/types.js";
import type { SourceType } from "../../types/schemas.js";
import type { RecognitionRunInsert } from "./run-record.js";
import type {
  RecognitionResultRow,
  RecognitionStage,
  RecognitionTaskRow,
} from "./types.js";

interface CreateRecognitionTaskParams {
  ownerUserId: string;
  sourceUrl: string;
  sourceMedia: Json | null;
  options: Json;
  idempotencyKey: string | null;
}

export type CreateRecognitionTaskOutcome =
  | { status: "created" | "existing"; task: RecognitionTaskRow }
  | { status: "quota"; quota: RecognitionQuota };

const createRecognitionTaskOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["created", "existing"]), task: z.object({ id: z.string().uuid() }).passthrough() }),
  recognitionQuotaSchema.extend({ status: z.literal("quota") }),
]);

interface ClaimRecognitionParams {
  workerIdentifier: string;
  claimBatchSize: number;
}

interface RecoverStaleRecognitionParams {
  staleAfterMilliseconds: number;
  claimBatchSize: number;
}

interface RequeueRecognitionParams {
  recognitionId: string;
  errorMessage: string;
  backoff: { retryCount: number; delayMilliseconds: number };
}

interface CompleteRecognitionParams {
  recognitionId: string;
  resultId: string;
}

interface FailRecognitionParams {
  recognitionId: string;
  errorMessage: string;
}

interface UpsertRecognitionResultParams {
  sourceUrl: string;
  places: Json;
  /** The post announced venues whose names were not in what the model read. */
  namesElsewhere: boolean;
  videoUrl: string | null;
  caption: string | null;
  sourceType: SourceType;
  /** Written only when present, so a failed copy never erases an earlier cover. */
  sourceThumbnailUrl: string | null;
  /** Written only when present, so a share that does not name the author keeps an earlier one. */
  authorUsername: string | null;
  transcript: Json | null;
}

/** One of the owner's recognitions in a list: the task and its result's cover and count. */
export interface RecognitionSummaryRow {
  task: Pick<RecognitionTaskRow, "id" | "status" | "stage" | "source_url" | "result_id" | "created_at" | "finished_at">;
  result: null | {
    source_type: string | null;
    source_thumbnail_url: string | null;
    author_username: string | null;
    place_count: number;
  };
}

/** One of the owner's finished recognitions with the places its result holds. */
export interface RecentRecognitionRow {
  id: string;
  status: string;
  source_url: string;
  created_at: string;
  finished_at: string | null;
  result: null | { source_type: string | null; author_username: string | null; places: Json };
}

/** A finished recognition as the API presents it: the task and what its result says. */
export interface RecognitionWithResult {
  task: RecognitionTaskRow;
  places: Json | null;
  names_elsewhere: boolean;
}

export class RecognitionRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  /**
   * Creates a queued task, paid for by the daily allowance or a credit (`create_recognition_task`
   * reserves it under the person's account lock). A repeated idempotency key returns the
   * original task; with neither allowance nor credits left, nothing is created.
   */
  async createRecognitionTask(params: CreateRecognitionTaskParams): Promise<CreateRecognitionTaskOutcome> {
    const { data, error } = await this.supabaseClient.rpc("create_recognition_task", {
      p_owner_user_id: params.ownerUserId,
      p_source_url: params.sourceUrl,
      p_source_media: params.sourceMedia,
      p_options: params.options,
      p_idempotency_key: params.idempotencyKey,
    });
    if (error) throw error;
    const outcome = createRecognitionTaskOutcomeSchema.parse(data);
    if (outcome.status === "quota") {
      const { status: _, ...quota } = outcome;
      return { status: "quota", quota };
    }
    return { status: outcome.status, task: outcome.task as RecognitionTaskRow };
  }

  async getRecognitionByIdForOwner(
    recognitionId: string,
    ownerUserId: string,
  ): Promise<RecognitionWithResult | null> {
    const { data: task, error } = await this.supabaseClient
      .from("recognition_tasks")
      .select("*")
      .eq("id", recognitionId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    if (!task) return null;

    if (!task.result_id) {
      return { task, places: null, names_elsewhere: false };
    }

    const { data: result, error: resultError } = await this.supabaseClient
      .from("recognition_results")
      .select("places, names_elsewhere")
      .eq("id", task.result_id)
      .maybeSingle();
    if (resultError) throw resultError;

    return { task, places: result?.places ?? null, names_elsewhere: result?.names_elsewhere ?? false };
  }

  /**
   * Returns a recognition_results row only if the current user owns at least one
   * recognition_tasks row pointing at this result_id.
   */
  async getRecognitionResultByIdForOwner(
    resultId: string,
    ownerUserId: string,
  ): Promise<RecognitionResultRow | null> {
    return (await this.getOwnedRecognitionResult(resultId, ownerUserId))?.result ?? null;
  }

  /**
   * The result and the owner's latest task that produced it (several people, or one person
   * twice, can share a result); null when no task of the owner points at it.
   */
  async getOwnedRecognitionResult(
    resultId: string,
    ownerUserId: string,
  ): Promise<{ result: RecognitionResultRow; taskId: string } | null> {
    const { data: tasks, error: taskError } = await this.supabaseClient
      .from("recognition_tasks")
      .select("id")
      .eq("result_id", resultId)
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (taskError) throw taskError;
    const taskId = tasks?.[0]?.id;
    if (!taskId) return null;

    const { data: result, error } = await this.supabaseClient
      .from("recognition_results")
      .select("*")
      .eq("id", resultId)
      .maybeSingle();
    if (error) throw error;
    return result ? { result, taskId } : null;
  }

  async claimQueuedRecognitions(params: ClaimRecognitionParams): Promise<RecognitionTaskRow[]> {
    const { data, error } = await this.supabaseClient.rpc("claim_recognitions", {
      p_worker_identifier: params.workerIdentifier,
      p_claim_limit: params.claimBatchSize,
    });

    if (error) {
      console.error(`[recognition-repo] claim_recognitions RPC error: ${error.message} (code=${error.code})`);
      throw error;
    }
    return (data ?? []) as RecognitionTaskRow[];
  }

  async recoverStaleRecognitions(params: RecoverStaleRecognitionParams): Promise<RecognitionTaskRow[]> {
    const { data, error } = await this.supabaseClient.rpc("recover_stale_recognitions", {
      p_stale_after_milliseconds: params.staleAfterMilliseconds,
      p_claim_limit: params.claimBatchSize,
    });

    if (error) throw error;
    return (data ?? []) as RecognitionTaskRow[];
  }

  async getRecognitionResultBySourceUrl(
    sourceUrl: string,
  ): Promise<RecognitionResultRow | null> {
    const { data, error } = await this.supabaseClient
      .from("recognition_results")
      .select("*")
      .eq("source_url", sourceUrl)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async upsertRecognitionResult(params: UpsertRecognitionResultParams): Promise<RecognitionResultRow> {
    const { data, error } = await this.supabaseClient
      .from("recognition_results")
      .upsert(
        {
          source_url: params.sourceUrl,
          places: params.places,
          names_elsewhere: params.namesElsewhere,
          video_url: params.videoUrl,
          caption: params.caption,
          source_type: params.sourceType,
          ...(params.sourceThumbnailUrl ? { source_thumbnail_url: params.sourceThumbnailUrl } : {}),
          ...(params.authorUsername ? { author_username: params.authorUsername } : {}),
          transcript: params.transcript,
        },
        { onConflict: "source_url" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async setStage(recognitionId: string, stage: RecognitionStage): Promise<void> {
    const { error } = await this.supabaseClient.from("recognition_tasks").update({ stage }).eq("id", recognitionId);
    if (error) throw error;
  }

  /** The owner's latest recognitions, newest first, with each result's cover and place count. */
  async listRecognitionsForOwner(ownerUserId: string, limit: number): Promise<RecognitionSummaryRow[]> {
    const { data, error } = await this.supabaseClient
      .from("recognition_tasks")
      .select(
        "id, status, stage, source_url, result_id, created_at, finished_at, recognition_results (source_type, source_thumbnail_url, author_username, places)",
      )
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw error;

    type Row = RecognitionSummaryRow["task"] & {
      recognition_results: null | { source_type: string | null; source_thumbnail_url: string | null; author_username: string | null; places: Json };
    };
    return (data as unknown as Row[]).map(({ recognition_results: result, ...task }) => ({
      task,
      result: result && {
        source_type: result.source_type,
        source_thumbnail_url: result.source_thumbnail_url,
        author_username: result.author_username,
        place_count: Array.isArray(result.places) ? result.places.length : 0,
      },
    }));
  }

  /**
   * The owner's latest finished recognitions with their places, newest first: what the DM
   * assistant answers "the places in the reel I just sent" from.
   */
  async listRecentRecognitionsWithPlaces(ownerUserId: string, limit: number): Promise<RecentRecognitionRow[]> {
    const { data, error } = await this.supabaseClient
      .from("recognition_tasks")
      .select("id, status, source_url, created_at, finished_at, recognition_results (source_type, author_username, places)")
      .eq("owner_user_id", ownerUserId)
      .in("status", ["completed", "committed"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw error;

    type Row = Omit<RecentRecognitionRow, "result"> & {
      recognition_results: null | { source_type: string | null; author_username: string | null; places: Json };
    };
    return (data as unknown as Row[]).map(({ recognition_results: result, ...task }) => ({
      ...task,
      result: result && { source_type: result.source_type, author_username: result.author_username, places: result.places },
    }));
  }

  async insertRun(run: RecognitionRunInsert): Promise<void> {
    const { error } = await this.supabaseClient.from("recognition_runs").insert(run);
    if (error) throw error;
  }

  async completeRecognition(params: CompleteRecognitionParams): Promise<void> {
    const { error } = await this.supabaseClient
      .from("recognition_tasks")
      .update({
        status: "completed",
        result_id: params.resultId,
        finished_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", params.recognitionId);

    if (error) throw error;
  }

  async requeueRecognition(params: RequeueRecognitionParams): Promise<void> {
    const { error } = await this.supabaseClient
      .from("recognition_tasks")
      .update({
        status: "queued",
        error_message: params.errorMessage,
        retry_count: params.backoff.retryCount,
        started_at: null,
        stage: null,
        available_at: new Date(Date.now() + params.backoff.delayMilliseconds).toISOString(),
      })
      .eq("id", params.recognitionId);

    if (error) throw error;
  }

  async failRecognition(params: FailRecognitionParams): Promise<void> {
    const { error } = await this.supabaseClient
      .from("recognition_tasks")
      .update({
        status: "failed",
        error_message: params.errorMessage,
        finished_at: new Date().toISOString(),
      })
      .eq("id", params.recognitionId);

    if (error) throw error;
  }

  async markRecognitionCommitted(
    recognitionId: string,
    ownerUserId: string,
  ): Promise<RecognitionTaskRow | null> {
    const { data, error } = await this.supabaseClient
      .from("recognition_tasks")
      .update({
        status: "committed",
      })
      .eq("id", recognitionId)
      .eq("owner_user_id", ownerUserId)
      .eq("status", "completed")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
