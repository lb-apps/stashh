import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { config } from "../../config.js";
import type { Database } from "../../types/database.js";
import { ASSISTANT_PROMPT } from "./prompt.js";

/**
 * The assistant's settings: one row the owner edits from the ops dashboard, read on every
 * turn (through a short cache), so a change applies within seconds and needs no deploy. The
 * environment keeps the defaults the row is seeded with and what the backend falls back to
 * when the row cannot be read.
 */

export interface AssistantSettings {
  model: string;
  /** null = the prompt shipped in the backend (`prompt.md`). */
  systemPrompt: string | null;
  maxSteps: number;
  dailyTurnCap: number;
  suggestedReplies: boolean;
  enabled: boolean;
  updatedAt: string | null;
}

/** What the dashboard may change; every field optional, validated like the table's checks. */
export const assistantSettingsPatchSchema = z
  .object({
    model: z.string().trim().min(1).max(200),
    system_prompt: z.string().min(1).max(60_000).nullable(),
    max_steps: z.number().int().min(1).max(12),
    daily_turn_cap: z.number().int().min(1).max(10_000),
    suggested_replies: z.boolean(),
    enabled: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, "Nothing to change");
export type AssistantSettingsPatch = z.infer<typeof assistantSettingsPatchSchema>;

type Row = Database["public"]["Tables"]["assistant_settings"]["Row"];

function toSettings(row: Row): AssistantSettings {
  return {
    model: row.model,
    systemPrompt: row.system_prompt,
    maxSteps: row.max_steps,
    dailyTurnCap: row.daily_turn_cap,
    suggestedReplies: row.suggested_replies,
    enabled: row.enabled,
    updatedAt: row.updated_at,
  };
}

/** The environment's values: what the row is seeded with, and the fallback when it cannot be read. */
export function defaultAssistantSettings(): AssistantSettings {
  return {
    model: config.ASSISTANT_MODEL,
    systemPrompt: null,
    maxSteps: config.ASSISTANT_MAX_STEPS,
    dailyTurnCap: config.ASSISTANT_DAILY_TURN_CAP,
    suggestedReplies: config.ASSISTANT_SUGGESTED_REPLIES === "on",
    enabled: true,
    updatedAt: null,
  };
}

export class AssistantSettingsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async get(): Promise<AssistantSettings | null> {
    const { data, error } = await this.supabase.from("assistant_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    return data ? toSettings(data) : null;
  }

  async update(patch: AssistantSettingsPatch): Promise<AssistantSettings> {
    const { data, error } = await this.supabase
      .from("assistant_settings")
      .upsert({ id: true, ...patch }, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw error;
    return toSettings(data);
  }
}

/** How long a read settings row is reused before the table is asked again. */
const SETTINGS_TTL_MS = 15_000;
let cached: { settings: AssistantSettings; readAt: number } | null = null;

/** The current settings, from the table (cached briefly) or the environment when the table is unreadable. */
export async function resolveAssistantSettings(repo: AssistantSettingsRepository, now = Date.now()): Promise<AssistantSettings> {
  if (cached && now - cached.readAt < SETTINGS_TTL_MS) return cached.settings;
  try {
    const settings = (await repo.get()) ?? defaultAssistantSettings();
    cached = { settings, readAt: now };
    return settings;
  } catch {
    return cached?.settings ?? defaultAssistantSettings();
  }
}

/** After a write: the next turn reads the table again. */
export function forgetAssistantSettings(): void {
  cached = null;
}

/** The prompt a turn runs with: the owner's, or the shipped one. */
export function systemPromptOf(settings: AssistantSettings): string {
  return settings.systemPrompt ?? ASSISTANT_PROMPT;
}
