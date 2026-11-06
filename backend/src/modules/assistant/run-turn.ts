import { z } from "zod/v4";
import type { ChatCompletion, ChatCompletionRequest, ChatMessage, ModelUsage, ToolCall, ToolDefinition } from "../../lib/openrouter.js";
import type { Logger } from "../../lib/logger.js";
import { cleanUntrustedText, contactKey, findContactTokens } from "../../lib/untrusted-text.js";
import { languageHintLine } from "./language.js";
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

/** Heads the newest message inside the final user turn: the one thing to answer, apart from everything above it. */
export const NEWEST_MESSAGE_NOTE =
  "## Their newest message (answer this one alone; your earlier replies above are delivered, do not send their text or cards again)";

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
  // The cached document first, then the history as it was, then one user message that carries the
  // live account block and, clearly marked, the newest message: the model reads the block as "now"
  // and the message as the one thing to answer, not as a continuation of what it already said.
  const messages: ChatMessage[] = [
    { role: "system", content: [{ type: "text", text: input.systemPrompt, cache_control: { type: "ephemeral" } }] },
    ...input.history,
    { role: "user", content: [input.contextBlock, "", NEWEST_MESSAGE_NOTE, ...(languageHintLine(input.userMessage) ? [languageHintLine(input.userMessage)] : []), input.userMessage].join("\n") },
  ];
  let usage: TurnUsage = { prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cost_usd: null };
  /** Links, phones and e-mails the reply may repeat: Stashh's own domain and what tools returned this turn. */
  const trusted = new Set<string>(TRUSTED_CONTACTS);
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
      const reply = text ? parseReply({ id: "content", name: REPLY_TOOL, arguments: { text: text.slice(0, 900) }, rawArguments: "" }, trusted) : null;
      if (reply?.ok) return { reply: reply.value, status: "replied", steps: step, usage, toolNames, model, provider };
      break;
    }

    messages.push({
      role: "assistant",
      content: completion.content,
      tool_calls: calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.rawArguments } })),
    });

    const replyCall = calls.find((call) => call.name === REPLY_TOOL);
    const dataCalls = calls.filter((call) => call.name !== REPLY_TOOL);
    const reply = replyCall ? parseReply(replyCall, trusted) : null;

    if (reply?.ok && dataCalls.length === 0) {
      return { reply: reply.value, status: "replied", steps: step, usage, toolNames, model, provider };
    }
    // A reply written beside tool calls was written before their results: it may say "deleted"
    // for a call that was refused or failed. The calls run, and the model replies again.
    if (reply?.ok) input.log.info({ tools: dataCalls.map((c) => c.name) }, "reply came with tool calls; running them first");
    else if (reply) input.log.warn({ step, error: reply.error }, "reply arguments rejected; asking the model to repair");

    const results = await Promise.all(
      dataCalls.map(async (call) => {
        toolNames.push(call.name);
        if (call.parseError) return { call, result: { error: "INVALID_ARGUMENTS", message: `arguments are not JSON: ${call.parseError}` } };
        return { call, result: await input.execute(call.name, call.arguments) };
      }),
    );
    for (const entry of results) collectTrusted(entry.result, trusted);
    for (const call of calls) {
      if (call.name === REPLY_TOOL) {
        const answer = call === replyCall && reply?.ok
          ? { error: "REPLY_NOT_SENT", message: "Not sent: your other tool calls ran first. Read their results, then call reply alone with what actually happened." }
          : { error: "INVALID_REPLY", message: call === replyCall && reply && !reply.ok ? reply.error : "call reply once per step" };
        messages.push({ role: "tool", tool_call_id: call.id, content: toolResultContent(answer) });
        continue;
      }
      const match = results.find((entry) => entry.call.id === call.id);
      messages.push({ role: "tool", tool_call_id: call.id, content: toolResultContent(match?.result) });
    }
  }

  input.log.warn({ maxSteps: input.maxSteps, toolNames }, "turn ended without a reply; sending the fallback");
  return { reply: FALLBACK_REPLY, status: "fallback", steps: input.maxSteps, usage, toolNames, model, provider };
}

const TRUSTED_CONTACTS = ["url:stashh.me"];

/**
 * Every link, phone, e-mail and wallet in a tool result, so the reply may repeat it (a place's
 * website, its phone). A key ending in `_untrusted` holds text a stranger wrote and adds nothing.
 */
export function collectTrusted(value: unknown, into: Set<string>, key?: string): void {
  if (key?.endsWith("_untrusted")) return;
  if (typeof value === "string") {
    for (const token of findContactTokens(value)) into.add(contactKey(token));
  } else if (Array.isArray(value)) {
    for (const item of value) collectTrusted(item, into);
  } else if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) collectTrusted(child, into, childKey);
  }
}

/**
 * A `reply` call checked beyond its schema. Its words reach the person as Stashh's, so a link,
 * phone number, e-mail or wallet in them must have come from a tool result of this turn: one
 * that came from a post's text, or from nowhere, is what an injected instruction would plant.
 */
export function parseReply(call: ToolCall, trusted: ReadonlySet<string> = new Set(TRUSTED_CONTACTS)): { ok: true; value: ReplyInput } | { ok: false; error: string } {
  if (call.parseError) return { ok: false, error: `arguments are not JSON: ${call.parseError}` };
  const parsed = replySchema.safeParse(call.arguments ?? {});
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) };

  const value: ReplyInput = { ...parsed.data, text: cleanUntrustedText(parsed.data.text, 900) || parsed.data.text };
  const visible = [value.text, ...(value.quick_replies?.map((item) => item.title) ?? []), value.cards?.kind === "lists" ? value.cards.button_title : ""].join("\n");
  const foreign = findContactTokens(visible).filter((token) => token.kind !== "handle" && !trusted.has(contactKey(token)));
  if (foreign.length > 0) {
    return {
      ok: false,
      error: `Your reply contains ${foreign.map((token) => `"${token.value}"`).join(", ")}, which no tool returned this turn. Write it again without links, phone numbers or e-mails of your own.`,
    };
  }
  return { ok: true, value };
}
