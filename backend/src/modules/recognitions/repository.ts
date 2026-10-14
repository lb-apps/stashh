import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import type { SourceType } from "../../types/schemas.js";
import type {
  RecognitionResultRow,
  RecognitionTaskInsert,
  RecognitionTaskRow,
} from "./types.js";

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
  videoUrl: string;
  caption: string | null;
  sourceType: SourceType;
}

export class RecognitionRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  async createQueuedRecognition(recognition: RecognitionTaskInsert): Promise<RecognitionTaskRow> {
    const { data, error } = await this.supabaseClient
      .from("recognition_tasks")
      .insert(recognition)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async getRecognitionByIdempotencyKey(
    ownerUserId: string,
    idempotencyKey: string,
  ): Promise<RecognitionTaskRow | null> {
    const { data, error } = await this.supabaseClient
      .from("recognition_tasks")
      .select("*")
      .eq("owner_user_id", ownerUserId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getRecognitionByIdForOwner(
    recognitionId: string,
    ownerUserId: string,
  ): Promise<{ task: RecognitionTaskRow; places: Json | null } | null> {
    const { data: task, error } = await this.supabaseClient
      .from("recognition_tasks")
      .select("*")
      .eq("id", recognitionId)
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (error) throw error;
    if (!task) return null;

    if (!task.result_id) {
      return { task, places: null };
    }

    const { data: result, error: resultError } = await this.supabaseClient
      .from("recognition_results")
      .select("places")
      .eq("id", task.result_id)
      .maybeSingle();
    if (resultError) throw resultError;

    return { task, places: result?.places ?? null };
  }

  /**
   * Returns a recognition_results row only if the current user owns at least one
   * recognition_tasks row pointing at this result_id.
   */
  async getRecognitionResultByIdForOwner(
    resultId: string,
    ownerUserId: string,
  ): Promise<RecognitionResultRow | null> {
    const { data: tasks, error: taskError } = await this.supabaseClient
      .from("recognition_tasks")
      .select("id")
      .eq("result_id", resultId)
      .eq("owner_user_id", ownerUserId)
      .limit(1);
    if (taskError) throw taskError;
    if (!tasks?.length) return null;

    const { data: result, error } = await this.supabaseClient
      .from("recognition_results")
      .select("*")
      .eq("id", resultId)
      .maybeSingle();
    if (error) throw error;
    return result;
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
          video_url: params.videoUrl,
          caption: params.caption,
          source_type: params.sourceType,
        },
        { onConflict: "source_url" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
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
