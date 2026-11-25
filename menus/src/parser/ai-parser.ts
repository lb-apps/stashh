import type { Logger } from "../lib/logger.ts";
import { aiParseResultSchema, type AiParseResult } from "./schema.ts";

const SYSTEM_PROMPT = `You are a menu extraction specialist. Given the text content of a restaurant/venue menu page, extract ALL menu items into structured JSON.

Rules:
- Extract every item with its name, description, price, and category
- If the menu has both Turkish and English, include both (name + name_en, description + description_en)
- Detect the menu type: food, drinks, desserts, hookah, services, room_service, or unknown
- Detect the language: tr, en, or tr+en
- Preserve the original category structure
- Prices should be numbers only (no currency symbols)
- Currency should be the ISO code (TRY, EUR, USD, etc.)
- Tags like vegan, glutensiz, spicy, popular, new should be extracted
- portion_info for size/duration info (200ml, 2 kişilik, 30 dakika)
- If an item has no price, set price to null
- Keep the original ordering

Return ONLY valid JSON matching this schema:
{
  "menus": [{
    "menu_type": "food|drinks|desserts|hookah|services|room_service|unknown",
    "language": "tr|en|tr+en",
    "categories": [{
      "name": "Category Name",
      "name_en": "English Name or null",
      "description": "Category description or null",
      "description_en": "English description or null",
      "image_url": "URL or null",
      "items": [{
        "name": "Item Name",
        "name_en": "English Name or null",
        "description": "Description or null",
        "description_en": "English description or null",
        "price": 150.00,
        "currency": "TRY",
        "image_url": "URL or null",
        "is_available": true,
        "tags": ["vegan"],
        "portion_info": "200ml"
      }]
    }]
  }]
}`;

export async function parseMenuContent(
  content: string,
  imageUrls: string[],
  apiKey: string,
  log: Logger,
): Promise<AiParseResult | null> {
  const userMessage = imageUrls.length > 0
    ? `Menu content:\n\n${content}\n\nAvailable image URLs from the page:\n${imageUrls.join("\n")}`
    : `Menu content:\n\n${content}`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 16_000,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.warn({ status: response.status, body: body.slice(0, 500) }, "OpenRouter parse request failed");
      return null;
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0]?.message?.content;
    if (!raw) {
      log.warn({ choicesLen: data.choices?.length }, "OpenRouter returned no content");
      return null;
    }

    const json: unknown = JSON.parse(raw);
    const parsed = aiParseResultSchema.safeParse(json);
    if (!parsed.success) {
      log.warn({ issues: parsed.error.issues.slice(0, 3) }, "AI output failed validation");
      return null;
    }

    return parsed.data;
  } catch (error) {
    log.warn({ err: error }, "AI parse error");
    return null;
  }
}
