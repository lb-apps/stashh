import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import type { ResolvedOpsRange } from "./types.js";

const QUEUE_LIMIT = 50;
const RECOGNITIONS_LIMIT = 60;
const ASSISTANT_TURNS_LIMIT = 60;

/** Read-only queries behind the ops endpoint. Service role: they span every user's tasks. */
export class OpsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async recognitionStats({ since, bucket }: ResolvedOpsRange): Promise<Json> {
    const { data, error } = await this.db.rpc("recognition_ops_stats", { p_since: since.toISOString(), p_bucket: bucket });
    if (error) throw error;
    return data;
  }

  /** How each outside service (fetchers, model, Google, storage, database) did for fresh runs. */
  async dependencies({ since }: ResolvedOpsRange): Promise<Json> {
    const { data, error } = await this.db.rpc("recognition_ops_dependencies", { p_since: since.toISOString() });
    if (error) throw error;
    return data;
  }

  /** Tasks waiting or running right now, oldest first. */
  async liveQueue() {
    const { data, error } = await this.db
      .from("recognition_tasks")
      .select("id, source_url, status, retry_count, created_at, started_at")
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: true })
      .limit(QUEUE_LIMIT);
    if (error) throw error;
    return data;
  }

  /** The latest recognitions with source type, channel, cover, places and cost. */
  async recentRecognitions(): Promise<Json> {
    const { data, error } = await this.db.rpc("recognition_ops_list", { p_limit: RECOGNITIONS_LIMIT });
    if (error) throw error;
    return data;
  }

  /** One recognition's whole story, or null when no such task exists. */
  async recognitionDetail(taskId: string): Promise<Json | null> {
    const { data, error } = await this.db.rpc("recognition_ops_detail", { p_task_id: taskId });
    if (error) throw error;
    return data ?? null;
  }

  /** The DM assistant in the window: turns by status, cost, tokens, durations, tools, models. */
  async assistantStats({ since, bucket }: ResolvedOpsRange): Promise<Json> {
    const { data, error } = await this.db.rpc("assistant_ops_stats", { p_since: since.toISOString(), p_bucket: bucket });
    if (error) throw error;
    return data;
  }

  /** The latest assistant turns with who asked, what, and what was answered. */
  async recentAssistantTurns(): Promise<Json> {
    const { data, error } = await this.db.rpc("assistant_ops_list", { p_limit: ASSISTANT_TURNS_LIMIT });
    if (error) throw error;
    return data;
  }

  /** One assistant turn in full with the conversation around it, or null when no such turn exists. */
  async assistantTurnDetail(turnId: string): Promise<Json | null> {
    const { data, error } = await this.db.rpc("assistant_ops_detail", { p_turn_id: turnId });
    if (error) throw error;
    return data ?? null;
  }
}
