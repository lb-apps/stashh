import { afterEach, describe, expect, it } from "vitest";
import {
  AssistantSettingsRepository,
  assistantSettingsPatchSchema,
  defaultAssistantSettings,
  forgetAssistantSettings,
  resolveAssistantSettings,
  systemPromptOf,
  type AssistantSettings,
} from "../src/modules/assistant/settings.js";
import { ASSISTANT_PROMPT } from "../src/modules/assistant/prompt.js";

const row: AssistantSettings = { model: "openai/gpt-6-luna", systemPrompt: "Owner prompt", maxSteps: 4, dailyTurnCap: 30, suggestedReplies: true, enabled: true, updatedAt: "2026-11-04T12:00:00Z" };

function repo(answers: Array<AssistantSettings | null | Error>) {
  const reads: number[] = [];
  return {
    reads,
    async get() {
      reads.push(1);
      const answer = answers.shift();
      if (answer instanceof Error) throw answer;
      return answer ?? null;
    },
  } as unknown as AssistantSettingsRepository & { reads: number[] };
}

afterEach(() => forgetAssistantSettings());

describe("resolveAssistantSettings", () => {
  it("reads the row once and reuses it for a short while", async () => {
    const r = repo([row, row]);
    expect(await resolveAssistantSettings(r, 1000)).toEqual(row);
    expect(await resolveAssistantSettings(r, 5000)).toEqual(row);
    expect(r.reads).toHaveLength(1);
    await resolveAssistantSettings(r, 1000 + 20_000);
    expect(r.reads).toHaveLength(2);
  });

  it("falls back to the environment when there is no row, and to the last read when the table fails", async () => {
    const r = repo([null, new Error("db down")]);
    expect(await resolveAssistantSettings(r, 0)).toEqual(defaultAssistantSettings());
    forgetAssistantSettings();
    expect(await resolveAssistantSettings(r, 0)).toEqual(defaultAssistantSettings());
  });

  it("forgets the cache after a write", async () => {
    const r = repo([row, { ...row, model: "anthropic/claude-haiku-5.5" }]);
    await resolveAssistantSettings(r, 0);
    forgetAssistantSettings();
    expect((await resolveAssistantSettings(r, 0)).model).toBe("anthropic/claude-haiku-5.5");
  });
});

describe("systemPromptOf", () => {
  it("uses the owner's prompt when set, else the shipped one", () => {
    expect(systemPromptOf(row)).toBe("Owner prompt");
    expect(systemPromptOf({ ...row, systemPrompt: null })).toBe(ASSISTANT_PROMPT);
  });
});

describe("assistantSettingsPatchSchema", () => {
  it("accepts a partial change and rejects an empty or out-of-range one", () => {
    expect(assistantSettingsPatchSchema.safeParse({ enabled: false }).success).toBe(true);
    expect(assistantSettingsPatchSchema.safeParse({ system_prompt: null }).success).toBe(true);
    expect(assistantSettingsPatchSchema.safeParse({}).success).toBe(false);
    expect(assistantSettingsPatchSchema.safeParse({ max_steps: 0 }).success).toBe(false);
    expect(assistantSettingsPatchSchema.safeParse({ model: "" }).success).toBe(false);
  });
});
