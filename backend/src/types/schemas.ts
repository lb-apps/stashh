import type { ModelUsage } from "../lib/openrouter.js";

// ── Source content result ──────────────────────────────────

/** Platform a recognition source URL belongs to. */
export type SourcePlatform = "instagram" | "tiktok";

/** Post shape. Instagram distinguishes reel/post/story; TikTok has one form. */
export type SourceType = "reel" | "post" | "story" | "tiktok";

/** Normalised scrape result, whichever platform it came from. */
export interface SourceContent {
  /** Directly fetchable video or image URL, downloaded and handed to the model. */
  media_url: string;
  /** Post caption. Instagram: og:description. TikTok: the post title. */
  caption: string | null;
  source_type: SourceType;
  platform: SourcePlatform;
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
  location_hint: string | null;
  /** Venue Instagram handle when visible in caption (@tag) or video; omit leading @ */
  instagram_username: string | null;
  /** Explicit must-try / ordering tips for this venue from the post */
  recommendations: VenueRecommendation[];
  confidence_score: number;
  source: "caption" | "video" | "both";
}

export interface AIAnalysisResult {
  places: ExtractedPlace[];
  /** What the media turned out to be, from its Content-Type. */
  media_kind: "video" | "image";
  media_bytes: number;
  /** Model and upstream provider that answered, and what the call cost. */
  model: string;
  provider: string | null;
  usage: ModelUsage | null;
}

// ── Google Places enrichment ───────────────────────────────

export interface MatchedPlace {
  google_place_id: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number } | null;
  rating: number | null;
  /**
   * First Places API photo resource name (e.g. places/.../photos/...).
   * Persist to storage only when the user saves the place via POST /places.
   */
  first_photo_name: string | null;
}

// ── Final API response ─────────────────────────────────────

export interface ExtractedPlaceWithMatch {
  raw_name: string;
  location_hint: string | null;
  instagram_username: string | null;
  recommendations: VenueRecommendation[];
  confidence_score: number;
  source: "caption" | "video" | "both";
  matched_place: MatchedPlace | null;
}

export interface RecognitionPipelineResponse {
  status: "completed" | "failed";
  source_url: string;
  source_content: SourceContent;
  extracted_places: ExtractedPlaceWithMatch[];
}
