import { config } from "../../config.js";
import { detectMediaType } from "../../lib/media-type.js";
import { createOpenRouterClient, type ContentPart } from "../../lib/openrouter.js";
import type { Logger } from "../../lib/logger.js";
import type {
  AIAnalysisResult,
  SourceMediaItem,
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

const SYSTEM_PROMPT = `You extract featured venues from one social post (caption + its video, image or carousel slides).

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
- names_elsewhere: true only when the post presents several venues (a list, a route, "10 places", "15 mekan", "les 5 meilleures adresses") whose names are not readable in the media and caption given here, so they must sit on slides you were not given. False when the venues are named, or when the post is about one venue.

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
    names_elsewhere: {
      type: "boolean",
      description:
        "True only when the post presents several venues whose names are not in the media and caption given (a list post seen by its cover); false when venues are named or the post is about one venue",
    },
  },
  required: ["places", "names_elsewhere"],
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

interface DownloadedMedia {
  url: string;
  kind: MediaKind;
  part: ContentPart;
  bytes: number;
}

async function fetchMedia(mediaUrl: string, log: Logger): Promise<DownloadedMedia> {
  const t0 = Date.now();
  const res = await fetch(mediaUrl);
  if (!res.ok) throw new Error(`Failed to fetch media: HTTP ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error(`Media response body was empty`);
  const media = toMediaPart(res.headers.get("content-type"), buffer);
  log.info({ kind: media.kind, size: Math.round(buffer.length / 1024), duration: Date.now() - t0 }, "media downloaded");
  return { url: mediaUrl, ...media, bytes: buffer.length };
}

/** The items that fit the byte budget, in post order; a slide past it is dropped, never truncated. */
function withinBudget(items: DownloadedMedia[], budgetBytes: number, log: Logger): DownloadedMedia[] {
  const kept: DownloadedMedia[] = [];
  let total = 0;
  for (const item of items) {
    if (kept.length > 0 && total + item.bytes > budgetBytes) break;
    kept.push(item);
    total += item.bytes;
  }
  if (kept.length < items.length) {
    log.warn({ slides: items.length, kept: kept.length, budgetBytes }, "media over the byte budget; trailing slides dropped");
  }
  return kept;
}

/**
 * The instruction that goes with the media. A carousel is named as one so the model
 * reads every slide: the names of a "15 places" post sit as text on slides 2–15 while
 * the caption only introduces the list.
 */
export function buildUserText(input: { platform: SourcePlatform; mediaKind: MediaKind; slideCount: number; caption: string | null }): string {
  const { platform, mediaKind, slideCount, caption } = input;
  const carousel = slideCount > 1;

  // An @handle in a TikTok caption is a TikTok handle, not an Instagram one.
  // Writing it into `instagram_username` would store wrong data, so on TikTok we
  // explicitly ask the model to leave the field null.
  const handleRule =
    platform === "instagram"
      ? `For instagram_username: only if that @handle appears in this caption or as a clear @ on-screen for that venue in the ${carousel ? "slides" : mediaKind}.`
      : "For instagram_username: always return null. This post is from TikTok, so any @handle here is a TikTok handle, not an Instagram one.";

  const postNoun =
    platform === "tiktok"
      ? "TikTok video"
      : carousel
        ? `Instagram carousel post of ${slideCount} slides`
        : `Instagram ${mediaKind === "image" ? "photo post" : "post"}`;

  const carouselRule = carousel
    ? "\n\nRead every slide. Venue names often appear as text on the slides, in any language, while the caption only introduces the list; return every venue the post features, in slide order."
    : "";

  return caption
    ? `Extract featured venues and any concrete per-venue recommendations from this ${postNoun}.${carouselRule}\n\nPost caption:\n${caption}\n\n${handleRule}`
    : `Extract featured venues and any concrete per-venue recommendations visible or audible in this ${postNoun}.${carouselRule}\n\n${handleRule}`;
}

/** Media parts for the model: each slide of a carousel is announced by its number so the model can refer to it. */
export function buildMediaParts(items: Array<{ part: ContentPart }>): ContentPart[] {
  if (items.length === 1) return [items[0]!.part];
  return items.flatMap((item, index) => [{ type: "text" as const, text: `Slide ${index + 1} of ${items.length}:` }, item.part]);
}

export async function analyzeContent(
  media: SourceMediaItem[],
  caption: string | null,
  log: Logger,
  platform: SourcePlatform = "instagram",
): Promise<AIAnalysisResult> {
  if (media.length === 0) throw new Error("No media to analyze");
  log.debug({
    hasCaption: Boolean(caption?.trim()),
    captionHasAt: Boolean(caption?.includes("@")),
    captionLength: caption?.length ?? 0,
    media: media.length,
  }, "analyze start");

  const downloaded = await Promise.all(media.map((item) => fetchMedia(item.url, log)));
  const items = withinBudget(downloaded, config.RECOGNITIONS_MAX_MEDIA_BYTES, log);
  const mediaKind: MediaKind = items.some((item) => item.kind === "video") ? "video" : "image";
  const mediaBytes = items.reduce((sum, item) => sum + item.bytes, 0);

  const t = Date.now();

  const userText = buildUserText({ platform, mediaKind, slideCount: items.length, caption });

  let completion;
  try {
    completion = await openRouter.complete({
      model: config.OPENROUTER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            ...buildMediaParts(items),
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
    names_elsewhere?: boolean;
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

  log.info({ duration: Date.now() - t, model: completion.model, kind: mediaKind, media: items.length }, "media analyzed");

  return {
    names_elsewhere: parsed.names_elsewhere === true,
    media_kind: mediaKind,
    media_bytes: mediaBytes,
    media_count: items.length,
    video_url: items.find((item) => item.kind === "video")?.url ?? null,
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
