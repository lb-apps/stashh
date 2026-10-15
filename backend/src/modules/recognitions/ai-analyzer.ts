import { config } from "../../config.js";
import { detectMediaType } from "../../lib/media-type.js";
import { createOpenRouterClient, type ContentPart } from "../../lib/openrouter.js";
import type { Logger } from "../../lib/logger.js";
import type {
  AIAnalysisResult,
  SourcePlatform,
  VenueCategory,
  VenueRecommendation,
  VenueRecommendationKind,
} from "../../types/schemas.js";

const venueRecommendationKindValues: VenueRecommendationKind[] = [
  "dish",
  "drink",
  "cocktail",
  "dessert",
  "activity",
  "ordering",
  "timing",
  "general",
];

const venueCategoryValues: VenueCategory[] = [
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  "dessert",
  "hotel",
  "attraction",
  "shop",
  "other",
];

function normalizeCategory(raw: string | null | undefined): VenueCategory {
  return raw && (venueCategoryValues as string[]).includes(raw) ? (raw as VenueCategory) : "other";
}

/** Instagram mention in caption: @handle must appear as a real token (not @foo matching @foobar). */
function captionContainsInstagramMention(caption: string, handle: string): boolean {
  const h = handle.trim().replace(/^@+/, "").toLowerCase();
  if (!h || h.length > 30) return false;
  if (!/^[a-z0-9._]+$/i.test(h)) return false;
  const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`@${escaped}(?![a-z0-9._])`, "i").test(caption);
}

function enforceInstagramUsernamePolicy(
  modelHandle: string | null | undefined,
  caption: string | null | undefined,
): string | null {
  const trimmed = modelHandle?.trim().replace(/^@+/, "") ?? "";
  if (!trimmed) return null;
  const cap = caption?.trim();
  if (!cap) return null;
  return captionContainsInstagramMention(cap, trimmed) ? trimmed : null;
}

function normalizeRecommendations(
  raw: Array<{ summary?: string; kind?: string }> | null | undefined,
): VenueRecommendation[] {
  if (!raw?.length) return [];
  const allowed = new Set<string>(venueRecommendationKindValues);
  const out: VenueRecommendation[] = [];
  for (const item of raw) {
    const summary = item.summary?.trim();
    if (!summary) continue;
    const kind = item.kind && allowed.has(item.kind) ? (item.kind as VenueRecommendationKind) : "general";
    out.push({ summary, kind });
  }
  return out;
}

const openRouter = createOpenRouterClient({ apiKey: config.OPENROUTER_API_KEY });

const SYSTEM_PROMPT = `You extract featured venues from one social post (caption + its video or image).

Rules:
- Return only specific businesses likely to have a Google Maps listing.
- A venue is a named business or attraction. A city, neighborhood, street, square or address is never a venue, even when the post names only that.
- Exclude venues mentioned only as landmarks (e.g. "across from X").
- The post may be in any language; keep each venue's name as the post writes it.
- Prefer precision over recall; if unsure, omit.
- instagram_username: only include a handle if the caption contains that exact @mention for the venue, or the video or image clearly shows an @username for that business. Otherwise null. Never infer from business name, speech, signage without @, or URL paths.
- recommendations must include only explicit creator tips tied to that venue.
- recommendations summary must be English, concise, imperative, and neutral.
- For consumables (dish/drink/cocktail/dessert), use "Try ..." phrasing.
- If no valid featured venue exists, return places: [].

Output must strictly follow the provided JSON schema.`;

// Strict JSON Schema (OpenRouter structured outputs): every property is required and
// optional values are expressed as nullable types.
const responseSchema = {
  type: "object",
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The venue's proper name" },
          category: {
            type: "string",
            enum: venueCategoryValues,
            description:
              "What kind of place it is: restaurant (incl. meyhane, taverna, bistro, street food), cafe (coffee, tea, brunch), bar (pub, cocktail, club, wine), bakery, dessert (patisserie, ice cream), hotel, attraction (museum, park, landmark, viewpoint), shop, other",
          },
          instagram_username: {
            type: ["string", "null"],
            description:
              "Handle without @ only if post caption includes that @mention or the video or image shows that @; else null",
          },
          location_hint: {
            type: ["string", "null"],
            description:
              "Where the venue is, for the Google Maps search only: neighborhood (if given), city, country, in the post's own language, e.g. \"Kadıköy, İstanbul, Türkiye\" or \"Kypseli, Athens, Greece\"; null if the post gives no clue",
          },
          address: {
            type: ["string", "null"],
            description:
              "The venue's street address exactly as the post writes it (street, number, district), only if the post states one in the caption or on screen; else null",
          },
          recommendations: {
            type: "array",
            description:
              "Only tips explicitly endorsed in caption, spoken audio, or on-screen text for this venue. Empty if the creator only shows food without recommendation language.",
            items: {
              type: "object",
              properties: {
                summary: {
                  type: "string",
                  description:
                    "English imperative tip; consumable kinds default to Try the … / Try … (not Order the …). Same voice as other summaries per system recommendation_voice (6-18 words, no emoji)",
                },
                kind: {
                  type: "string",
                  enum: venueRecommendationKindValues,
                  description: "Category for UI",
                },
              },
              required: ["summary", "kind"],
              additionalProperties: false,
            },
          },
          confidence_score: {
            type: "number",
            description: "Confidence between 0.0 and 1.0",
          },
          source: {
            type: "string",
            enum: ["video"],
          },
        },
        required: ["name", "category", "instagram_username", "location_hint", "address", "recommendations", "confidence_score", "source"],
        additionalProperties: false,
      },
    },
  },
  required: ["places"],
  additionalProperties: false,
};

type MediaKind = AIAnalysisResult["media_kind"];

/**
 * The model input for downloaded media. A feed post shared in a DM may be a photo or a
 * video, so the kind is not known up front. The Content-Type decides when it names a
 * video or image; otherwise the bytes do — Instagram's video CDN answers with
 * `application/octet-stream`. Media goes as a base64 data URL, the only form Gemini
 * accepts on OpenRouter.
 */
export function toMediaPart(contentType: string | null, bytes: Buffer): { kind: MediaKind; part: ContentPart } {
  const mimeType = detectMediaType(contentType, bytes);
  if (!mimeType) {
    const declared = contentType?.split(";")[0]?.trim().toLowerCase();
    throw new Error(`Post media has an unsupported content type: ${declared || "unknown"}`);
  }

  const url = `data:${mimeType};base64,${bytes.toString("base64")}`;
  return mimeType.startsWith("video/")
    ? { kind: "video", part: { type: "video_url", video_url: { url } } }
    : { kind: "image", part: { type: "image_url", image_url: { url } } };
}

async function fetchMedia(mediaUrl: string, log: Logger): Promise<{ kind: MediaKind; part: ContentPart; bytes: number }> {
  const t0 = Date.now();
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Failed to fetch media: HTTP ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error(`Media response body was empty`);
  const media = toMediaPart(res.headers.get("content-type"), buffer);
  log.info({ kind: media.kind, size: Math.round(buffer.length / 1024), duration: Date.now() - t0 }, "media downloaded");
  return { ...media, bytes: buffer.length };
}

export async function analyzeContent(
  mediaUrl: string,
  caption: string | null,
  log: Logger,
  platform: SourcePlatform = "instagram",
): Promise<AIAnalysisResult> {
  log.debug({
    hasCaption: Boolean(caption?.trim()),
    captionHasAt: Boolean(caption?.includes("@")),
    captionLength: caption?.length ?? 0,
  }, "analyze start");

  const media = await fetchMedia(mediaUrl, log);

  const t = Date.now();

  // An @handle in a TikTok caption is a TikTok handle, not an Instagram one.
  // Writing it into `instagram_username` would store wrong data, so on TikTok we
  // explicitly ask the model to leave the field null.
  const handleRule =
    platform === "instagram"
      ? `For instagram_username: only if that @handle appears in this caption or as a clear @ on-screen for that venue in the ${media.kind}.`
      : "For instagram_username: always return null. This post is from TikTok, so any @handle here is a TikTok handle, not an Instagram one.";

  const postNoun = platform === "tiktok" ? "TikTok video" : `Instagram ${media.kind === "image" ? "photo post" : "post"}`;

  const userText = caption
    ? `Extract featured venues and any concrete per-venue recommendations from this ${postNoun}.\n\nPost caption:\n${caption}\n\n${handleRule}`
    : `Extract featured venues and any concrete per-venue recommendations visible or audible in this ${postNoun}.\n\n${handleRule}`;

  let completion;
  try {
    completion = await openRouter.complete({
      model: config.OPENROUTER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            media.part,
            { type: "text", text: userText },
          ],
        },
      ],
      jsonSchema: { name: "featured_venues", schema: responseSchema },
      // Reasoning tokens count against max_tokens, so leave room for both.
      maxTokens: 16384,
      reasoningEffort: "low",
    });
  } catch (error) {
    throw new Error(`Model analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const text = completion.content;
  const finishReason = completion.finishReason;
  if (finishReason && finishReason !== "stop") {
    log.warn({ finishReason, model: completion.model }, "model non-stop finish reason");
  }
  log.debug({ responseLength: text.length, model: completion.model }, "raw response");

  let parsed: {
    places: Array<{
      name: string;
      category?: string | null;
      instagram_username?: string | null;
      location_hint?: string | null;
      address?: string | null;
      recommendations?: Array<{ summary?: string; kind?: string }>;
      confidence_score: number;
      source: "video";
    }>;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch (error) {
    const truncationNote = finishReason === "length" ? " (truncated)" : "";
    log.debug({ finishReason, responseLength: text.length, responseTail: text.slice(-200) }, "parse error context");
    throw new Error(`Failed to parse model JSON response: ${error instanceof Error ? error.message : String(error)}${truncationNote}`);
  }

  log.info({ duration: Date.now() - t, model: completion.model, kind: media.kind }, "media analyzed");

  return {
    media_kind: media.kind,
    media_bytes: media.bytes,
    model: completion.model,
    provider: completion.provider,
    usage: completion.usage,
    places: parsed.places.map((p) => {
      const raw = p.instagram_username?.trim().replace(/^@/, "") ?? "";
      const instagram_username = enforceInstagramUsernamePolicy(raw || null, caption);
      log.debug({
        venue: p.name,
        modelRaw: raw || null,
        accepted: instagram_username,
      }, "username policy");
      if (raw && !instagram_username) {
        const reason = caption?.trim()
          ? "handle not found as @mention in caption"
          : "no caption text (cannot verify @)";
        log.info({ venue: p.name, modelHandle: raw, reason }, "instagram_username dropped");
      }
      return {
        name: p.name,
        category: normalizeCategory(p.category),
        location_hint: p.location_hint ?? null,
        address: p.address?.trim() || null,
        instagram_username,
        recommendations: normalizeRecommendations(p.recommendations),
        confidence_score: p.confidence_score,
        source: p.source,
      };
    }),
  };
}
