// ── Instagram content result ───────────────────────────────

export interface InstagramContent {
  video_url: string;          // CDN URL from APIhut — passed directly to Gemini
  caption: string | null;     // Post caption from og:description
  source_type: "reel" | "post" | "story";
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
  instagram_content: InstagramContent;
  extracted_places: ExtractedPlaceWithMatch[];
}
