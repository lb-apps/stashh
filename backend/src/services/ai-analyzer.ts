import { GoogleGenAI, Type, createPartFromUri } from "@google/genai";
import { config } from "../config.js";
import type { AIAnalysisResult, VenueRecommendation, VenueRecommendationKind } from "../types/schemas.js";

const DEBUG_TRACE = process.env["RECOGNITIONS_DEBUG_TRACE"] === "true";

function trace(label: string, data?: unknown): void {
  if (!DEBUG_TRACE) return;
  if (data === undefined) {
    console.log(`[recognitions:trace] ${label}`);
    return;
  }
  console.log(`[recognitions:trace] ${label}`, data);
}

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

/**
 * Only accept a handle when the post caption text proves an @mention (same token rules as Instagram).
 * If we have no caption string from the scraper, we cannot verify mentions — always null (Gemini will
 * still guess from video; we discard). On-screen-only @ without caption in HTML is unsupported until
 * we parse caption from another source or add trusted vision.
 */
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

export interface ProgressEvent {
  step: "download" | "upload" | "analyze";
  status: "running" | "done";
  duration?: number;
  meta?: Record<string, unknown>;
}

export type ProgressCallback = (event: ProgressEvent) => void;

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

async function uploadVideoToGemini(
  videoUrl: string,
  onProgress: ProgressCallback,
): Promise<{ uri: string; name: string }> {
  // Step: download
  onProgress({ step: "download", status: "running" });
  const t0 = Date.now();
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(1);
  onProgress({ step: "download", status: "done", duration: Date.now() - t0, meta: { sizeMb } });
  console.log(`[ai-analyzer] Downloaded ${sizeMb}MB in ${Date.now() - t0}ms`);

  // Step: upload
  onProgress({ step: "upload", status: "running" });
  const t1 = Date.now();
  const blob = new Blob([buffer], { type: "video/mp4" });
  const uploadedFile = await genai.files.upload({
    file: blob,
    config: { mimeType: "video/mp4", displayName: "instagram-reel" },
  });

  let file = uploadedFile;
  while (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    file = await genai.files.get({ name: file.name! });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini file processing failed: state=${file.state}`);

  onProgress({ step: "upload", status: "done", duration: Date.now() - t1 });
  console.log(`[ai-analyzer] Uploaded & processed in ${Date.now() - t1}ms`);

  return { uri: file.uri!, name: file.name! };
}

export async function analyzeContent(
  videoUrl: string,
  caption: string | null,
  onProgress: ProgressCallback = () => {},
): Promise<AIAnalysisResult> {
  trace("analyzeContent.start", {
    hasCaption: Boolean(caption?.trim()),
    captionHasAt: Boolean(caption?.includes("@")),
    captionLength: caption?.length ?? 0,
  });
  const { uri: fileUri, name: fileName } = await uploadVideoToGemini(videoUrl, onProgress);

  onProgress({ step: "analyze", status: "running" });
  const t = Date.now();

  const userText = caption
    ? `Extract featured venues and any concrete per-venue recommendations from this Instagram post.\n\nPost caption:\n${caption}\n\nFor instagram_username: only if that @handle appears in this caption or as clear @ on-screen for that venue in the video.`
    : "Extract featured venues and any concrete per-venue recommendations visible or audible in this Instagram video.\n\nFor instagram_username: only if an @handle for that venue is clearly visible on screen in the video.";

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [createPartFromUri(fileUri, "video/mp4"), { text: userText }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema,
      maxOutputTokens: 2048,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response");
  trace("gemini.response.raw", text);

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
    trace("gemini.response.parse_error", {
      message: error instanceof Error ? error.message : String(error),
      responseText: text,
    });
    throw error;
  }
  trace("gemini.response.parsed_places", parsed.places.map((p) => ({
    name: p.name,
    instagram_username: p.instagram_username ?? null,
    source: p.source,
    confidence_score: p.confidence_score,
  })));

  onProgress({ step: "analyze", status: "done", duration: Date.now() - t, meta: { count: parsed.places.length } });
  console.log(`[ai-analyzer] Analyzed in ${Date.now() - t}ms — ${parsed.places.length} places`);

  genai.files.delete({ name: fileName }).catch(() => {});

  return {
    places: parsed.places.map((p) => {
      const raw = p.instagram_username?.trim().replace(/^@/, "") ?? "";
      const instagramUsername = enforceInstagramUsernamePolicy(raw || null, caption);
      trace("instagram_username.policy", {
        venue: p.name,
        modelRaw: raw || null,
        accepted: instagramUsername,
        captionHasAt: Boolean(caption?.includes("@")),
      });
      if (raw && !instagramUsername) {
        const reason = caption?.trim()
          ? "handle not found as @mention in caption"
          : "no caption text from Instagram fetch (cannot verify @)";
        console.log(`[ai-analyzer] instagram_username dropped (${reason}; model="${raw}")`);
      }
      return {
        name: p.name,
        locationHint: p.location_hint ?? null,
        instagramUsername,
        recommendations: normalizeRecommendations(p.recommendations),
        confidenceScore: p.confidence_score,
        source: p.source,
      };
    }),
  };
}
