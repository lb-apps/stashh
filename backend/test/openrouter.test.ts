import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenRouterClient, OpenRouterError } from "../src/lib/openrouter.js";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const client = createOpenRouterClient({ apiKey: "sk-or-test" });
const request = {
  model: "google/gemini-3.8-flash",
  messages: [
    { role: "system" as const, content: "system" },
    {
      role: "user" as const,
      content: [
        { type: "video_url" as const, video_url: { url: "data:video/mp4;base64,AAAA" } },
        { type: "text" as const, text: "extract" },
      ],
    },
  ],
  jsonSchema: { name: "featured_venues", schema: { type: "object" } },
  maxTokens: 16384,
  reasoningEffort: "low" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenRouter client", () => {
  it("sends a strict structured-output request and returns the message content", async () => {
    const fetchMock = stubFetch(200, {
      model: "google/gemini-3.8-flash",
      choices: [{ finish_reason: "stop", message: { content: '{"places":[]}' } }],
    });

    const completion = await client.complete(request);

    expect(completion).toEqual({ content: '{"places":[]}', finishReason: "stop", model: "google/gemini-3.8-flash" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-or-test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: "google/gemini-3.8-flash",
      max_tokens: 16384,
      reasoning: { effort: "low", exclude: true },
      response_format: { type: "json_schema", json_schema: { name: "featured_venues", strict: true, schema: { type: "object" } } },
      provider: { require_parameters: true },
    });
    expect(body.messages[1].content[0]).toEqual({ type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } });
  });

  it("surfaces an HTTP error with OpenRouter's message", async () => {
    stubFetch(402, { error: { code: 402, message: "Insufficient credits" } });
    await expect(client.complete(request)).rejects.toThrow(new OpenRouterError(402, "Insufficient credits"));
  });

  it("surfaces a provider error reported inside a 200 response", async () => {
    stubFetch(200, { model: "m", choices: [{ finish_reason: "error", message: { content: null }, error: { message: "upstream failed" } }] });
    await expect(client.complete(request)).rejects.toThrow("upstream failed");
  });

  it("rejects an empty completion", async () => {
    stubFetch(200, { model: "m", choices: [{ finish_reason: "stop", message: { content: "" } }] });
    await expect(client.complete(request)).rejects.toThrow("empty response");
  });

  it("reports an unreachable API as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));
    await expect(client.complete(request)).rejects.toMatchObject({ status: 0 });
  });
});
