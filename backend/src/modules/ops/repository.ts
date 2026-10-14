import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import type { ResolvedOpsRange } from "./types.js";

const QUEUE_LIMIT = 50;
const RECOGNITIONS_LIMIT = 60;

/** Read-only queries behind the ops endpoint. Service role: they span every user's tasks. */
export class OpsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async recognitionStats({ since, bucket }: ResolvedOpsRange): Promise<Json> {
    const { data, error } = await this.db.rpc("recognition_ops_stats", { p_since: since.toISOString(), p_bucket: bucket });
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
}
