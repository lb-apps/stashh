import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/database.js";
import type { AssistantChannel, ReplyPlan } from "./types.js";

export type AssistantTurnRow = Database["public"]["Tables"]["assistant_turns"]["Row"];
export type AssistantTurnInsert = Database["public"]["Tables"]["assistant_turns"]["Insert"];
export type AssistantMessageRow = Database["public"]["Tables"]["assistant_messages"]["Row"];
export type AssistantMessageInsert = Database["public"]["Tables"]["assistant_messages"]["Insert"];

/** Persistence for `assistant_turns` and `assistant_messages`. Service role only (no RLS policies). */
export class AssistantRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /** The conversation so far: newest `limit` messages since `since`, returned oldest first. */
  async listRecentMessages(userId: string, channel: AssistantChannel, options: { limit: number; since: Date }): Promise<AssistantMessageRow[]> {
    const { data, error } = await this.supabase
      .from("assistant_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("channel", channel)
      .gte("created_at", options.since.toISOString())
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(options.limit);
    if (error) throw error;
    return (data ?? []).reverse();
  }

  /** The finished turn a user message with this id belongs to, if it was handled before. */
  async findTurnByExternalId(channel: AssistantChannel, externalId: string): Promise<AssistantTurnRow | null> {
    const { data, error } = await this.supabase
      .from("assistant_messages")
      .select("turn_id")
      .eq("channel", channel)
      .eq("external_message_id", externalId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.turn_id) return null;

    const { data: turn, error: turnError } = await this.supabase.from("assistant_turns").select("*").eq("id", data.turn_id).maybeSingle();
    if (turnError) throw turnError;
    return turn;
  }

  /** Turns the user had in the window, for the daily cap; capped turns do not count. */
  async countTurnsSince(userId: string, channel: AssistantChannel, since: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from("assistant_turns")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("channel", channel)
      .neq("status", "capped")
      .gte("created_at", since.toISOString());
    if (error) throw error;
    return count ?? 0;
  }

  async insertTurn(row: Omit<AssistantTurnInsert, "plan"> & { plan: ReplyPlan | null }): Promise<AssistantTurnRow> {
    const { data, error } = await this.supabase
      .from("assistant_turns")
      .insert({ ...row, plan: row.plan as unknown as Json })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  /** Stores messages; a user message whose external id was stored before (a retried turn) is left as is. */
  async insertMessages(rows: AssistantMessageInsert[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.supabase
      .from("assistant_messages")
      .upsert(rows, { onConflict: "channel,external_message_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}
