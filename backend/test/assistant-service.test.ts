import { describe, expect, it } from "vitest";
import type { ChatCompletion, ChatCompletionRequest } from "../src/lib/openrouter.js";
import { rootLogger } from "../src/lib/logger.js";
import type { AssistantMessageInsert, AssistantMessageRow, AssistantRepository, AssistantTurnRow } from "../src/modules/assistant/repository.js";
import { AssistantService, CAPPED_REPLY, formatInbound } from "../src/modules/assistant/service.js";
import type { ToolServices } from "../src/modules/assistant/tools.js";
import type { ReplyPlan } from "../src/modules/assistant/types.js";

const USER = "00000000-0000-4000-8000-000000000001";
const LIST = "11111111-1111-4111-8111-111111111111";

/** In-memory `assistant_turns` + `assistant_messages` with the repository's contract. */
class MemoryRepo implements Pick<AssistantRepository, "listRecentMessages" | "findTurnByExternalId" | "countTurnsSince" | "insertTurn" | "insertMessages"> {
  turns: AssistantTurnRow[] = [];
  messages: AssistantMessageRow[] = [];
  private seq = 0;

  async listRecentMessages(userId: string, channel: string, { limit, since }: { limit: number; since: Date }) {
    return this.messages
      .filter((m) => m.user_id === userId && m.channel === channel && new Date(m.created_at) >= since)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || (a.role === "user" ? -1 : 1))
      .slice(-limit);
  }

  async findTurnByExternalId(channel: string, externalId: string) {
    const message = this.messages.find((m) => m.channel === channel && m.external_message_id === externalId);
    return (message?.turn_id && this.turns.find((t) => t.id === message.turn_id)) || null;
  }

  async countTurnsSince(userId: string, channel: string, since: Date) {
    return this.turns.filter((t) => t.user_id === userId && t.channel === channel && t.status !== "capped" && new Date(t.created_at) >= since).length;
  }

  async insertTurn(row: Parameters<AssistantRepository["insertTurn"]>[0]) {
    const turn = {
      id: `turn-${++this.seq}`,
      created_at: new Date().toISOString(),
      model: null,
      provider: null,
      steps: 0,
      prompt_tokens: null,
      completion_tokens: null,
      cached_tokens: null,
      cost_usd: null,
      duration_ms: null,
      tool_names: [],
      error: null,
      ...row,
    } as unknown as AssistantTurnRow;
    this.turns.push(turn);
    return turn;
  }

  async insertMessages(rows: AssistantMessageInsert[]) {
    for (const row of rows) {
      if (row.external_message_id && this.messages.some((m) => m.channel === row.channel && m.external_message_id === row.external_message_id)) continue;
      this.messages.push({ id: `msg-${++this.seq}`, rich: null, external_message_id: null, turn_id: null, created_at: new Date().toISOString(), ...row } as AssistantMessageRow);
    }
  }
}

function scriptedModel(steps: Array<Array<{ name: string; args: unknown }>>) {
  const requests: ChatCompletionRequest[] = [];
  return {
    requests,
    async complete(request: ChatCompletionRequest): Promise<ChatCompletion> {
      requests.push(structuredClone(request));
      const step = steps.shift();
      if (!step) throw new Error("model called more often than scripted");
      return {
        content: null,
        toolCalls: step.map((call, i) => ({ id: `c${requests.length}-${i}`, name: call.name, arguments: call.args, rawArguments: JSON.stringify(call.args) })),
        finishReason: "tool_calls",
        model: "test/model",
        provider: "Anthropic",
        usage: { prompt_tokens: 2000, completion_tokens: 60, reasoning_tokens: 0, cached_tokens: 1800, cost_usd: 0.0004 },
      };
    },
  };
}

function tools(): ToolServices {
  const unexpected = async (): Promise<never> => {
    throw new Error("unexpected service call");
  };
  const listRow = { id: LIST, title: "İzmir", description: null, emoji: "🌊", cover_category: null, created_at: "t", updated_at: "t", place_count: 2 };
  return {
    lists: { listLists: async () => [listRow], listPlaces: unexpected, createList: unexpected, updateList: unexpected, deleteList: unexpected, addPlace: unexpected, removePlaceByPlaceId: unexpected },
    places: { getSavedPlace: unexpected, deleteSavedPlace: unexpected, markVisited: unexpected, clearVisited: unexpected, listSavedPlaces: unexpected },
    placesRepo: { searchSavedPlaces: unexpected, getSavedPlacesByPlaceIds: async () => [], getPlacesByGoogleIds: async () => [], countSavedPlaces: async () => 2 },
    recognitions: { listRecentRecognitionsWithPlaces: async () => [] },
    signInLinks: { mint: async () => ({ url: "https://stashh.me/app/a/code" }) },
  };
}

function service(repo: MemoryRepo, model: ReturnType<typeof scriptedModel>, dailyTurnCap = 60) {
  return new AssistantService({
    repo: repo as unknown as AssistantRepository,
    model,
    modelId: "test/model",
    systemPrompt: "SYSTEM PROMPT",
    tools: tools(),
    identities: { findProfileByUserId: async () => ({ username: "emir", displayName: "Emir" }) },
    maxSteps: 4,
    dailyTurnCap,
    suggestedReplies: false,
    log: rootLogger,
  });
}

describe("AssistantService.turn", () => {
  it("runs a turn, records it with usage, and renders the plan", async () => {
    const repo = new MemoryRepo();
    const model = scriptedModel([[{ name: "reply", args: { text: "Tek listen var: İzmir.", quick_replies: [{ title: "Haritamı aç", payload: "OPEN_MAP" }], map_link: true } }]]);

    const plan = await service(repo, model).turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-1", text: "listelerim neler" }] });

    expect(plan).toEqual<ReplyPlan>({
      messages: [{ kind: "button", text: "Tek listen var: İzmir.", buttons: [{ type: "web_url", title: "stashh.me", url: "https://stashh.me/app/a/code" }], quick_replies: [{ title: "Haritamı aç", payload: "OPEN_MAP" }] }],
    });
    expect(repo.turns).toHaveLength(1);
    expect(repo.turns[0]).toMatchObject({ status: "replied", steps: 1, model: "test/model", provider: "Anthropic", prompt_tokens: 2000, cached_tokens: 1800, cost_usd: 0.0004, tool_names: [], plan });
    expect(repo.messages.map((m) => [m.role, m.content, m.external_message_id])).toEqual([
      ["user", "listelerim neler", "mid-1"],
      ["assistant", "Tek listen var: İzmir.", null],
    ]);
    expect(repo.messages[1]!.rich).toEqual({ quick_replies: ["Haritamı aç"], map_link: true });

    const request = model.requests[0]!;
    expect(request.messages[0]).toMatchObject({ role: "system", content: [{ text: "SYSTEM PROMPT", cache_control: { type: "ephemeral" } }] });
    const last = request.messages.at(-1) as { role: string; content: string };
    expect(last.role).toBe("user");
    expect(last.content).toContain(`🌊 İzmir · 2 places · list_id ${LIST}`);
    expect(last.content.endsWith("\nlistelerim neler")).toBe(true);
  });

  it("replays the stored plan for a message handled before, without calling the model", async () => {
    const repo = new MemoryRepo();
    const model = scriptedModel([[{ name: "reply", args: { text: "İlk cevap." } }]]);
    const svc = service(repo, model);
    const first = await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-1", text: "selam" }] });
    const again = await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-1", text: "selam" }] });
    expect(again).toEqual(first);
    expect(model.requests).toHaveLength(1);
    expect(repo.turns).toHaveLength(1);
  });

  it("stamps the person's messages at the turn's start and the reply at its end, so history pairs them in order", async () => {
    const repo = new MemoryRepo();
    let tick = 0;
    const now = () => new Date(1_700_000_000_000 + 1000 * tick++);
    const model = scriptedModel([[{ name: "reply", args: { text: "Bir." } }], [{ name: "reply", args: { text: "İki." } }]]);
    const svc = new AssistantService({
      repo: repo as unknown as AssistantRepository, model, modelId: "test/model", systemPrompt: "S", tools: tools(),
      identities: { findProfileByUserId: async () => null }, maxSteps: 4, dailyTurnCap: 60, suggestedReplies: false, log: rootLogger, now,
    });
    await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "a", text: "bir" }, { external_id: "b", text: "bir-devam" }] });
    await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "c", text: "iki" }] });
    const [a, b, reply1, c] = repo.messages;
    expect([a!.content, b!.content, reply1!.content, c!.content]).toEqual(["bir", "bir-devam", "Bir.", "iki"]);
    expect(a!.created_at < b!.created_at && b!.created_at < reply1!.created_at && reply1!.created_at < c!.created_at).toBe(true);
    const history = model.requests[1]!.messages.slice(1, -1);
    expect(history.map((m) => (m as { content: string }).content)).toEqual(["bir", "bir-devam", "Bir."]);
  });

  it("feeds earlier messages back as history with a note of what was shown", async () => {
    const repo = new MemoryRepo();
    const model = scriptedModel([
      [{ name: "reply", args: { text: "Listelerin:", cards: { kind: "lists", list_ids: [LIST], button_title: "Gör" } } }],
      [{ name: "reply", args: { text: "Tamam." } }],
    ]);
    const svc = service(repo, model);
    await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-1", text: "listelerim" }] });
    await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-2", text: "ok", tapped: { title: "Gör", payload: `SHOW_LIST:${LIST}` } }] });

    const second = model.requests[1]!.messages;
    expect(second.slice(1, 3)).toEqual([
      { role: "user", content: "listelerim" },
      { role: "assistant", content: "Listelerin:\n[you sent cards: 🌊 İzmir]" },
    ]);
    expect((second.at(-1) as { content: string }).content.endsWith(`\nok\n[tapped "Gör" · payload SHOW_LIST:${LIST}]`)).toBe(true);
  });

  it("answers with the cap line and no model call once the daily cap is reached", async () => {
    const repo = new MemoryRepo();
    const model = scriptedModel([[{ name: "reply", args: { text: "Bir." } }]]);
    const svc = service(repo, model, 1);
    await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-1", text: "bir" }] });
    const plan = await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-2", text: "iki" }] });
    expect(plan.messages).toEqual([{ kind: "text", text: CAPPED_REPLY.text }]);
    expect(model.requests).toHaveLength(1);
    expect(repo.turns.at(-1)).toMatchObject({ status: "capped" });
  });

  it("records a failed turn and rethrows", async () => {
    const repo = new MemoryRepo();
    const model = { requests: [], complete: async () => Promise.reject(new Error("OpenRouter request failed (502): bad gateway")) } as unknown as ReturnType<typeof scriptedModel>;
    await expect(service(repo, model).turn({ userId: USER, channel: "instagram", messages: [{ external_id: "mid-1", text: "selam" }] })).rejects.toThrow("bad gateway");
    expect(repo.turns[0]).toMatchObject({ status: "failed", error: expect.stringContaining("502") });
    // The next attempt for the same message runs the model again instead of replaying.
    expect((await repo.findTurnByExternalId("instagram", "mid-1"))?.status).toBe("failed");
  });
});

describe("AssistantService.turn when switched off", () => {
  it("sends the fixed line, records a fallback turn and never calls the model", async () => {
    const repo = new MemoryRepo();
    const model = scriptedModel([]);
    const svc = new AssistantService({
      repo: repo as unknown as AssistantRepository, model, modelId: "test/model", systemPrompt: "S", tools: tools(),
      identities: { findProfileByUserId: async () => null }, maxSteps: 4, dailyTurnCap: 60, suggestedReplies: false, enabled: false, log: rootLogger,
    });
    const plan = await svc.turn({ userId: USER, channel: "instagram", messages: [{ external_id: "off-1", text: "selam" }] });
    expect(plan.messages[0]).toMatchObject({ kind: "text" });
    expect(model.requests).toHaveLength(0);
    expect(repo.turns[0]).toMatchObject({ status: "fallback", error: "assistant disabled" });
  });
});

describe("formatInbound", () => {
  it("adds the tapped title and payload to the text", () => {
    expect(formatInbound({ external_id: "m", text: "Listeye koy", tapped: { title: "Listeye koy", payload: "ADD_TO_LIST:r1" } })).toBe('Listeye koy\n[tapped "Listeye koy" · payload ADD_TO_LIST:r1]');
    expect(formatInbound({ external_id: "m", text: "selam" })).toBe("selam");
  });
});
