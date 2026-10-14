import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import type { ResolvedOpsRange } from "./types.js";

const QUEUE_LIMIT = 50;
const RECENT_RUNS_LIMIT = 50;

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

  /** The latest worker attempts with their task's source. */
  async recentRuns() {
    const { data, error } = await this.db
      .from("recognition_runs")
      .select(
        "id, task_id, attempt, outcome, failed_step, error_message, started_at, finished_at, total_ms, fetch_ms, analysis_ms, match_ms, thumbnails_ms, save_ms, media_kind, model, cost_usd, places_extracted, places_matched, task:recognition_tasks(source_url)",
      )
      .order("finished_at", { ascending: false })
      .limit(RECENT_RUNS_LIMIT);
    if (error) throw error;
    return data.map(({ task, ...run }) => ({
      ...run,
      // PostgREST sends numeric as a string (exact decimal); the dashboard wants a number.
      cost_usd: run.cost_usd == null ? null : Number(run.cost_usd),
      source_url: task?.source_url ?? null,
    }));
  }
}
