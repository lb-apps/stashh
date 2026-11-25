import type { Logger } from "../lib/logger.ts";

interface VerifyContext {
  placeName: string;
  city?: string;
  menuSourceUrl: string;
}

const SYSTEM_PROMPT = `You are a verification specialist. Given a venue name, city, and a menu source URL, determine if the menu belongs to the venue.

Check:
1. Does the URL domain or path contain the venue name or a known alias?
2. If the menu mentions an address or location, does it match the city?
3. Could this be a completely different venue's menu?

Return JSON: { "belongs": true/false, "confidence": 0.0-1.0, "reason": "brief explanation" }`;

export async function verifyMenuBelongsToPlace(
  ctx: VerifyContext,
  menuText: string,
  apiKey: string,
  log: Logger,
): Promise<boolean> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-5.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Venue: ${ctx.placeName}\nCity: ${ctx.city ?? "unknown"}\nMenu URL: ${ctx.menuSourceUrl}\n\nMenu text (first 2000 chars):\n${menuText.slice(0, 2000)}`,
          },
        ],
        temperature: 0,
        max_tokens: 256,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return true;

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content;
    if (!raw) return true;

    const result = JSON.parse(raw) as { belongs: boolean; confidence: number; reason: string };
    log.debug({ ...result, place: ctx.placeName }, "menu verification");

    return result.belongs && result.confidence >= 0.5;
  } catch {
    return true;
  }
}
