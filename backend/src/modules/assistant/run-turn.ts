import { z } from "zod/v4";
import type { ChatCompletion, ChatCompletionRequest, ChatMessage, ModelUsage, ToolCall, ToolDefinition } from "../../lib/openrouter.js";
import type { Logger } from "../../lib/logger.js";
import { REPLY_TOOL, replySchema, type ReplyInput } from "./tools.js";

/** The slice of the OpenRouter client a turn needs; tests pass a scripted one. */
export interface TurnModel {
  complete(request: ChatCompletionRequest): Promise<ChatCompletion>;
}

export interface RunTurnInput {
  model: TurnModel;
  modelId: string;
  /** The stable document: cached, byte-identical across turns and users within a day. */
  systemPrompt: string;
  /** The per-turn account block: after the cache breakpoint, never inside it. */
  contextBlock: string;
  history: ChatMessage[];
  /** The person's message(s) this turn, already formatted as one user message. */
  userMessage: string;
  tools: ToolDefinition[];
  execute: (name: string, args: unknown) => Promise<unknown>;
  maxSteps: number;
  maxTokens?: number;
  log: Logger;
}

export interface TurnUsage {
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  cost_usd: number | null;
}

export interface RunTurnResult {
  /** The validated `reply` call, or the fixed fallback when the model never made one. */
  reply: ReplyInput;
  status: "replied" | "fallback";
  steps: number;
  usage: TurnUsage;
  toolNames: string[];
  model: string | null;
  provider: string | null;
}

/** Said when the model used every step without replying; Turkish, the channel's default language. */
export const FALLBACK_REPLY: ReplyInput = { text: "Buna şu an cevap veremedim. Bir daha dener misin?" };

/** Closes the live block: what came before is done, the next user message is the one to answer. */
export const NEWEST_MESSAGE_NOTE =
  "## Next\nThe person's newest message follows. Answer that message alone: your earlier replies above are already delivered, so do not send their text or their cards again.";

/** The most a tool result may be, as text, before it is cut; keeps one big list from eating the turn. */
const TOOL_RESULT_MAX_CHARS = 12_000;

function addUsage(total: TurnUsage, usage: ModelUsage | null): TurnUsage {
  if (!usage) return total;
  return {
    prompt_tokens: total.prompt_tokens + usage.prompt_tokens,
    completion_tokens: total.completion_tokens + usage.completion_tokens,
    cached_tokens: total.cached_tokens + usage.cached_tokens,
    cost_usd: usage.cost_usd === null ? total.cost_usd : (total.cost_usd ?? 0) + usage.cost_usd,
  };
}

function toolResultContent(result: unknown): string {
  const text = typeof result === "string" ? result : JSON.stringify(result ?? null);
  return text.length > TOOL_RESULT_MAX_CHARS ? `${text.slice(0, TOOL_RESULT_MAX_CHARS)}…(truncated)` : text;
}

/**
 * One assistant turn: the model is called with every tool and must call one each step. Data
 * tools run (in parallel when it asks for several) and their results go back; `reply` ends the
 * turn. A `reply` whose arguments do not validate is answered with the error so the model can
 * repair it in the next step. After `maxSteps` calls without a valid reply, the fallback is used.
 */
export async function runTurn(input: RunTurnInput): Promise<RunTurnResult> {
  // The cached document first; the live account block sits right before the newest message, after
  // the history, so the model reads it as "now" rather than as part of what was already answered.
  const messages: ChatMessage[] = [
    { role: "system", content: [{ type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } }] },
    ...input.history,
    { role: "system", content: `${input.contextBlock}

${NEWEST_MESSAGE_NOTE}` },
    { role: "user", content: input.userMessage },
  ];
  let usage: TurnUsage = { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cost_usd: null };
  const toolNames: string[] = [];
  let model: string | null = null;
  let provider: string | null = null;

  for (let step = 1; step <= input.maxSteps; step++) {
    const completion = await input.model.complete({
      model: input.modelId,
      messages,
      tools: input.tools,
      toolChoice: "required",
      maxTokens: input.maxTokens ?? 700,
    });
    usage = addUsage(usage, completion.usage);
    model = completion.model;
    provider = completion.provider;

    const calls = completion.toolCalls;
    if (calls.length === 0) {
      // Not supposed to happen under a forced tool choice; the text is still the best reply there is.
      const text = completion.content?.trim();
      if (text) return { reply: { text: text.slice(0, 900) }, status: "replied", steps: step, usage, toolNames, model, provider };
      break;
    }

    messages.push({
      role: "assistant",
      content: completion.content,
      tool_calls: calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.rawArguments } })),
    });

    const replyCall = calls.find((call) => call.name === REPLY_TOOL);
    const dataCalls = calls.filter((call) => call.name !== REPLY_TOOL);

    if (replyCall) {
      const reply = parseReply(replyCall);
      if (reply.ok) {
        if (dataCalls.length > 0) input.log.warn({ tools: dataCalls.map((c) => c.name) }, "tool calls beside reply ignored");
        return { reply: reply.value, status: "replied", steps: step, usage, toolNames, model, provider };
      }
      input.log.warn({ step, error: reply.error }, "reply arguments rejected; asking the model to repair");
    }

    const results = await Promise.all(
      dataCalls.map(async (call) => {
        toolNames.push(call.name);
        if (call.parseError) return { call, result: { error: "INVALID_ARGUMENTS", message: `arguments are not JSON: ${call.parseError}` } };
        return { call, result: await input.execute(call.name, call.arguments) };
      }),
    );
    for (const call of calls) {
      if (call.name === REPLY_TOOL) {
        const reply = parseReply(call);
        messages.push({ role: "tool", tool_call_id: call.id, content: toolResultContent(reply.ok ? { sent: true } : { error: "INVALID_REPLY", message: reply.error }) });
        continue;
      }
      const match = results.find((entry) => entry.call.id === call.id);
      messages.push({ role: "tool", tool_call_id: call.id, content: toolResultContent(match?.result) });
    }
  }

  input.log.warn({ maxSteps: input.maxSteps, toolNames }, "turn ended without a reply; sending the fallback");
  return { reply: FALLBACK_REPLY, status: "fallback", steps: input.maxSteps, usage, toolNames, model, provider };
}

function parseReply(call: ToolCall): { ok: true; value: ReplyInput } | { ok: false; error: string } {
  if (call.parseError) return { ok: false, error: `arguments are not JSON: ${call.parseError}` };
  const parsed = replySchema.safeParse(call.arguments ?? {});
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: z.prettifyError(parsed.error) };
}
