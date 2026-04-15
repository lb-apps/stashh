import { GoogleGenAI, Type, createPartFromUri } from "@google/genai";
import { config } from "../../config.js";
import type { Logger } from "../../lib/logger.js";
import type { AIAnalysisResult, VenueRecommendation, VenueRecommendationKind } from "../../types/schemas.js";

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

const genai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

const SYSTEM_PROMPT = `You extract featured venues from one Instagram post (caption + video).

Rules:
- Return only specific businesses likely to have a Google Maps listing.
- Never return cities, neighborhoods, streets, or generic place types.
- Exclude venues mentioned only as landmarks (e.g. "across from X").
- Prefer precision over recall; if unsure, omit.
- instagram_username: only include a handle if the caption contains that exact @mention for the venue, or the video clearly shows an @username on screen for that business. Otherwise null. Never infer from business name, speech, signage without @, or URL paths.
- recommendations must include only explicit creator tips tied to that venue.
- recommendations summary must be English, concise, imperative, and neutral.
- For consumables (dish/drink/cocktail/dessert), use "Try ..." phrasing.
- If no valid featured venue exists, return places: [].

Output must strictly follow the provided JSON schema.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    places: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The venue's proper name" },
          instagram_username: {
            type: Type.STRING,
            description:
              "Handle without @ only if post caption includes that @mention or video shows that @ on screen; else null",
            nullable: true,
          },
          location_hint: {
            type: Type.STRING,
            description: "City or neighborhood as a Google Maps search hint only",
            nullable: true,
          },
          recommendations: {
            type: Type.ARRAY,
            description:
              "Only tips explicitly endorsed in caption, spoken audio, or on-screen text for this venue. Empty if the creator only shows food without recommendation language.",
            items: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description:
                    "English imperative tip; consumable kinds default to Try the … / Try … (not Order the …). Same voice as other summaries per system recommendation_voice (6-18 words, no emoji)",
                },
                kind: {
                  type: Type.STRING,
                  enum: venueRecommendationKindValues,
                  description: "Category for UI",
                },
              },
              required: ["summary", "kind"],
            },
          },
          confidence_score: {
            type: Type.NUMBER,
            description: "Confidence between 0.0 and 1.0",
          },
          source: {
            type: Type.STRING,
            enum: ["video"],
          },
        },
        required: ["name", "instagram_username", "recommendations", "confidence_score", "source"],
      },
    },
  },
  required: ["places"],
};

const INLINE_VIDEO_MAX_BYTES = 20 * 1024 * 1024;

async function uploadVideoToGemini(
  videoUrl: string,
  log: Logger,
): Promise<{ fileRef: { uri: string; name: string } | null; inlineData: { data: string; mimeType: string } | null }> {
  const t0 = Date.now();
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to fetch video: HTTP ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) throw new Error(`Video response body was empty`);
  const size = Math.round(buffer.length / 1024);
  const downloadMs = Date.now() - t0;
  log.info({ size, duration: downloadMs }, "video downloaded");

  if (buffer.length <= INLINE_VIDEO_MAX_BYTES) {
    log.debug({ size }, "using inline data (under 20MB)");
    return {
      fileRef: null,
      inlineData: { data: buffer.toString("base64"), mimeType: "video/mp4" },
    };
  }

  const t1 = Date.now();
  const blob = new Blob([buffer], { type: "video/mp4" });
  let uploadedFile;
  try {
    uploadedFile = await genai.files.upload({
      file: blob,
      config: { mimeType: "video/mp4", displayName: "instagram-reel" },
    });
  } catch (uploadError) {
    const detail = uploadError instanceof Error ? uploadError.message : String(uploadError);
    throw new Error(`Gemini file upload failed: ${detail}`);
  }

  let file = uploadedFile;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    file = await genai.files.get({ name: file.name! });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini file processing finished with state="${file.state}"`);

  log.info({ duration: Date.now() - t1 }, "video uploaded to Gemini");
  return { fileRef: { uri: file.uri!, name: file.name! }, inlineData: null };
}

export async function analyzeContent(
  videoUrl: string,
  caption: string | null,
  log: Logger,
): Promise<AIAnalysisResult> {
  log.debug({
    hasCaption: Boolean(caption?.trim()),
    captionHasAt: Boolean(caption?.includes("@")),
    captionLength: caption?.length ?? 0,
  }, "analyze start");

  const { fileRef, inlineData } = await uploadVideoToGemini(videoUrl, log);

  const t = Date.now();

  const userText = caption
    ? `Extract featured venues and any concrete per-venue recommendations from this Instagram post.\n\nPost caption:\n${caption}\n\nFor instagram_username: only if that @handle appears in this caption or as clear @ on-screen for that venue in the video.`
    : "Extract featured venues and any concrete per-venue recommendations visible or audible in this Instagram video.\n\nFor instagram_username: only if an @handle for that venue is clearly visible on screen in the video.";

  const videoPart = inlineData
    ? { inlineData }
    : createPartFromUri(fileRef!.uri, "video/mp4");

  let response;
  try {
    response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [videoPart, { text: userText }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema,
        maxOutputTokens: 8192,
        temperature: 0.2,
      },
    });
  } catch (geminiError) {
    const detail = geminiError instanceof Error ? geminiError.message : String(geminiError);
    throw new Error(`Gemini generateContent failed: ${detail}`);
  }

  const text = response.text;
  const finishReason = response.candidates?.[0]?.finishReason;
  if (finishReason && finishReason !== "STOP") {
    log.warn({ finishReason }, "Gemini non-STOP finish reason");
  }
  if (!text) throw new Error("Gemini returned an empty response");
  log.debug({ responseLength: text.length }, "raw response");

  let parsed: {
    places: Array<{
      name: string;
      instagram_username?: string | null;
      location_hint?: string | null;
      recommendations?: Array<{ summary?: string; kind?: string }>;
      confidence_score: number;
      source: "video";
    }>;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch (error) {
    const truncationNote = finishReason === "MAX_TOKENS" ? " (truncated)" : "";
    log.debug({ finishReason, responseLength: text.length, responseTail: text.slice(-200) }, "parse error context");
    throw new Error(`Failed to parse Gemini JSON response: ${error instanceof Error ? error.message : String(error)}${truncationNote}`);
  }

  const analyzeMs = Date.now() - t;
  void analyzeMs;
  if (fileRef) {
    genai.files.delete({ name: fileRef.name }).catch(() => {});
  }

  return {
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
        location_hint: p.location_hint ?? null,
        instagram_username,
        recommendations: normalizeRecommendations(p.recommendations),
        confidence_score: p.confidence_score,
        source: p.source,
      };
    }),
  };
}
