import { z } from "zod";

/**
 * Minimal OpenRouter chat-completions client (https://openrouter.ai/docs/api_reference/overview).
 * Every model call in the backend goes through OpenRouter; nothing talks to a model vendor directly.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ContentPart =
  | { type: "text"; text: string }
  /** `url` is a `data:video/mp4;base64,…` URL; Gemini on OpenRouter does not fetch video URLs. */
  | { type: "video_url"; video_url: { url: string } }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user";
  content: string | ContentPart[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  /** Strict JSON-schema output; providers that cannot honour it are skipped. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
}

/** Token usage and cost of one call, as OpenRouter reports it on every response. */
export interface ModelUsage {
  prompt_tokens: number;
  completion_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  /** OpenRouter `usage.cost`, in USD credits. */
  cost_usd: number | null;
}

export interface ChatCompletion {
  content: string;
  /** Normalised by OpenRouter: "stop", "length", "content_filter", … */
  finishReason: string | null;
  model: string;
  /** Upstream provider OpenRouter routed to (e.g. "Google AI Studio"). */
  provider: string | null;
  usage: ModelUsage | null;
}

const usageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  prompt_tokens_details: z.object({ cached_tokens: z.number().optional() }).nullish(),
  completion_tokens_details: z.object({ reasoning_tokens: z.number().optional() }).nullish(),
  cost: z.number().nullish(),
});

const responseSchema = z.object({
  model: z.string(),
  provider: z.string().nullish(),
  usage: usageSchema.nullish(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({ content: z.string().nullable().optional() }),
        error: z.object({ message: z.string() }).optional(),
      }),
    )
    .min(1),
});

const errorSchema = z.object({ error: z.object({ message: z.string(), code: z.union([z.number(), z.string()]).optional() }) });

export class OpenRouterError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(`OpenRouter request failed (${status}): ${message}`);
    this.name = "OpenRouterError";
    this.status = status;
  }
}

export function createOpenRouterClient(options: { apiKey: string; timeoutMs?: number }) {
  const timeoutMs = options.timeoutMs ?? 180_000;

  return {
    async complete(request: ChatCompletionRequest): Promise<ChatCompletion> {
      const body = {
        model: request.model,
        messages: request.messages,
        ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        ...(request.reasoningEffort ? { reasoning: { effort: request.reasoningEffort, exclude: true } } : {}),
        ...(request.jsonSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: request.jsonSchema.name, strict: true, schema: request.jsonSchema.schema },
              },
              // Route only to providers that support every parameter we send (structured output).
              provider: { require_parameters: true },
            }
          : {}),
      };

      let response: Response;
      try {
        response = await fetch(OPENROUTER_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
            // Optional attribution headers (https://openrouter.ai/docs/app-attribution).
            "http-referer": "https://stashh.me",
            "x-title": "Stashh",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new OpenRouterError(0, error instanceof Error ? error.message : String(error));
      }

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const parsedError = errorSchema.safeParse(payload);
        throw new OpenRouterError(response.status, parsedError.success ? parsedError.data.error.message : response.statusText);
      }

      const parsed = responseSchema.safeParse(payload);
      if (!parsed.success) {
        const parsedError = errorSchema.safeParse(payload);
        throw new OpenRouterError(response.status, parsedError.success ? parsedError.data.error.message : "unexpected response body");
      }

      const choice = parsed.data.choices[0]!;
      if (choice.error) throw new OpenRouterError(response.status, choice.error.message);
      if (!choice.message.content) throw new OpenRouterError(response.status, "model returned an empty response");

      const usage = parsed.data.usage;
      return {
        content: choice.message.content,
        finishReason: choice.finish_reason ?? null,
        model: parsed.data.model,
        provider: parsed.data.provider ?? null,
        usage: usage
          ? {
              prompt_tokens: usage.prompt_tokens,
              completion_tokens: usage.completion_tokens,
              reasoning_tokens: usage.completion_tokens_details?.reasoning_tokens ?? 0,
              cached_tokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
              cost_usd: usage.cost ?? null,
            }
          : null,
      };
    },
  };
}

export type OpenRouterClient = ReturnType<typeof createOpenRouterClient>;
