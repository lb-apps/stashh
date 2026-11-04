import { describe, expect, it } from "vitest";
import type { ChatCompletion, ChatCompletionRequest } from "../src/lib/openrouter.js";
import { rootLogger } from "../src/lib/logger.js";
import { FALLBACK_REPLY, runTurn, type TurnModel } from "../src/modules/assistant/run-turn.js";
import { toolDefinitions } from "../src/modules/assistant/tools.js";

type Call = { name: string; args: unknown; id?: string };

/** A model that answers from a script of steps; each step is a list of tool calls or a text. */
function scripted(steps: Array<Call[] | string>): TurnModel & { requests: ChatCompletionRequest[] } {
  const requests: ChatCompletionRequest[] = [];
  let counter = 0;
  return {
    requests,
    async complete(request) {
      requests.push(structuredClone(request));
      const step = steps.shift();
      if (step === undefined) throw new Error("model called more often than scripted");
      const usage = { prompt_tokens: 1000, completion_tokens: 50, reasoning_tokens: 0, cached_tokens: requests.length > 1 ? 900 : 0, cost_usd: 0.001 };
      if (typeof step === "string") {
        return { content: step, toolCalls: [], finishReason: "stop", model: "m", provider: "p", usage } satisfies ChatCompletion;
      }
      return {
        content: null,
        toolCalls: step.map((call) => ({ id: call.id ?? `call_${++counter}`, name: call.name, arguments: call.args, rawArguments: JSON.stringify(call.args) })),
        finishReason: "tool_calls",
        model: "m",
        provider: "p",
        usage,
      } satisfies ChatCompletion;
    },
  };
}

function run(model: TurnModel, execute: (name: string, args: unknown) => Promise<unknown> = async () => ({ ok: true }), maxSteps = 6) {
  return runTurn({
    model,
    modelId: "test/model",
    systemPrompt: "SYSTEM",
    contextBlock: "CONTEXT",
    history: [{ role: "user", content: "earlier" }, { role: "assistant", content: "earlier answer" }],
    userMessage: "listelerim neler",
    tools: toolDefinitions(),
    execute,
    maxSteps,
    log: rootLogger,
  });
}

describe("runTurn", () => {
  it("ends on the first valid reply and reports the usage", async () => {
    const model = scripted([[{ name: "reply", args: { text: "Hiç listen yok." } }]]);
    const result = await run(model);
    expect(result).toMatchObject({ status: "replied", steps: 1, reply: { text: "Hiç listen yok." }, toolNames: [], model: "m", provider: "p" });
    expect(result.usage).toEqual({ prompt_tokens: 1000, completion_tokens: 50, cached_tokens: 0, cost_usd: 0.001 });

    const request = model.requests[0]!;
    expect(request.toolChoice).toBe("required");
    expect(request.tools?.map((tool) => tool.function.name)).toContain("reply");
    expect(request.messages[0]).toEqual({ role: "system", content: [{ type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } }] });
    expect(request.messages[1]).toEqual({ role: "system", content: "CONTEXT" });
    expect(request.messages.at(-1)).toEqual({ role: "user", content: "listelerim neler" });
  });

  it("runs data tools, feeds their results back and then takes the reply", async () => {
    const model = scripted([
      [{ name: "get_list_places", args: { list_id: "l1" }, id: "a" }, { name: "get_place", args: { place_id: "p1" }, id: "b" }],
      [{ name: "reply", args: { text: "İşte.", cards: { kind: "places", place_ids: ["6f1a4b6e-0b2a-4a4e-9a6e-3c1f6f8d9a10"] } } }],
    ]);
    const seen: string[] = [];
    const result = await run(model, async (name) => {
      seen.push(name);
      return { from: name };
    });

    expect(result.status).toBe("replied");
    expect(result.steps).toBe(2);
    expect(result.toolNames).toEqual(["get_list_places", "get_place"]);
    expect(result.usage.cached_tokens).toBe(900);
    const second = model.requests[1]!;
    const assistant = second.messages.at(-3);
    expect(assistant).toMatchObject({ role: "assistant", content: null, tool_calls: [{ id: "a" }, { id: "b" }] });
    expect(second.messages.at(-2)).toEqual({ role: "tool", tool_call_id: "a", content: '{"from":"get_list_places"}' });
    expect(second.messages.at(-1)).toEqual({ role: "tool", tool_call_id: "b", content: '{"from":"get_place"}' });
  });

  it("answers an invalid reply with the error so the model can repair it", async () => {
    const model = scripted([
      [{ name: "reply", args: { text: "", quick_replies: [{ title: "a title that is far too long for a quick reply" }] }, id: "bad" }],
      [{ name: "reply", args: { text: "Düzelttim." } }],
    ]);
    const result = await run(model);
    expect(result).toMatchObject({ status: "replied", steps: 2, reply: { text: "Düzelttim." } });
    const repair = model.requests[1]!.messages.at(-1);
    expect(repair).toMatchObject({ role: "tool", tool_call_id: "bad" });
    expect((repair as { content: string }).content).toContain("INVALID_REPLY");
  });

  it("passes an argument parse error to the tool as an error result", async () => {
    const model = scripted([[], [{ name: "reply", args: { text: "ok" } }]]);
    const broken = model.complete.bind(model);
    model.complete = async (request) => {
      const completion = await broken(request);
      if (model.requests.length === 1) {
        completion.toolCalls = [{ id: "x", name: "get_place", arguments: null, rawArguments: "{oops", parseError: "Unexpected token" }];
      }
      return completion;
    };
    const executed: string[] = [];
    const result = await run(model, async (name) => {
      executed.push(name);
      return {};
    });
    expect(result.status).toBe("replied");
    expect(executed).toEqual([]);
    expect(model.requests[1]!.messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "x" });
    expect((model.requests[1]!.messages.at(-1) as { content: string }).content).toContain("INVALID_ARGUMENTS");
  });

  it("falls back after the step budget without a reply", async () => {
    const model = scripted([[{ name: "get_map_link", args: {} }], [{ name: "get_map_link", args: {} }]]);
    const result = await run(model, async () => ({}), 2);
    expect(result).toMatchObject({ status: "fallback", steps: 2, reply: FALLBACK_REPLY, toolNames: ["get_map_link", "get_map_link"] });
  });

  it("takes plain text as the reply when the model sends no tool call", async () => {
    const model = scripted(["Düz metin."]);
    const result = await run(model);
    expect(result).toMatchObject({ status: "replied", reply: { text: "Düz metin." } });
  });
});
