import { z } from "zod";

// ── Request ────────────────────────────────────────────────

export const instagramUrlFieldSchema = z
  .string()
  .url()
  .refine(
    (url) => /instagram\.com\/(reel|p|stories)\//i.test(url),
    "Must be a valid Instagram Reel, Post, or Story URL",
  );

/** Body for POST /api/v1/recognitions/pipeline (sync run) */
export const recognitionPipelineBodySchema = z.object({
  instagram_url: instagramUrlFieldSchema,
});

/** Query params for GET /api/v1/recognitions/stream */
export const recognitionStreamQuerySchema = z.object({
  url: instagramUrlFieldSchema,
});

export type RecognitionPipelineBody = z.infer<typeof recognitionPipelineBodySchema>;

// ── Instagram content result ───────────────────────────────

export interface InstagramContent {
  videoUrl: string;           // CDN URL from APIhut — passed directly to Gemini
  caption: string | null;     // Post caption from og:description
  sourceType: "reel" | "post" | "story";
}

// ── AI extraction result ───────────────────────────────────

export type VenueRecommendationKind =
  | "dish"
  | "drink"
  | "cocktail"
  | "dessert"
  | "activity"
  | "ordering"
  | "timing"
  | "general";

/** Creator tip tied to a venue (caption, on-screen text, or audio) */
export interface VenueRecommendation {
  summary: string;
  kind: VenueRecommendationKind;
}

export interface ExtractedPlace {
  name: string;
  locationHint: string | null;
  /** Venue Instagram handle when visible in caption (@tag) or video; omit leading @ */
  instagramUsername: string | null;
  /** Explicit must-try / ordering tips for this venue from the post */
  recommendations: VenueRecommendation[];
  confidenceScore: number;
  source: "caption" | "video" | "both";
}

export interface AIAnalysisResult {
  places: ExtractedPlace[];
}

// ── Google Places enrichment ───────────────────────────────

export interface MatchedPlace {
  googlePlaceId: string;
  name: string;
  address: string;
  city: string | null;
  district: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  rating: number | null;
  priceLevel: number | null;
  /** App-managed thumbnail URL (stored in place-thumbnails bucket). */
  thumbnailUrl: string | null;
  phoneNumber: string | null;
  websiteUrl: string | null;
}

// ── Final API response ─────────────────────────────────────

export interface ExtractedPlaceWithMatch {
  rawName: string;
  locationHint: string | null;
  instagramUsername: string | null;
  recommendations: VenueRecommendation[];
  confidenceScore: number;
  source: "caption" | "video" | "both";
  matchedPlace: MatchedPlace | null;
}

export interface RecognitionPipelineResponse {
  status: "completed" | "failed";
  sourceUrl: string;
  extractedPlaces: ExtractedPlaceWithMatch[];
}
