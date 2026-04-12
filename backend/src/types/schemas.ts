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
  rating: number | null;
  /**
   * First Places API photo resource name (e.g. places/.../photos/...).
   * Persist to storage only when the user saves the place via POST /places.
   */
  firstPhotoName: string | null;
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
