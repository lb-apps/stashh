/** Mirrors the backend envelope payloads. Field names match the API exactly. */

export type RecognitionStatus =
  | "queued"
  | "processing"
  | "completed"
  | "committed"
  | "failed"
  | "expired"
  | "cancelled";

export type RecommendationKind =
  | "dish"
  | "drink"
  | "cocktail"
  | "dessert"
  | "activity"
  | "ordering"
  | "timing"
  | "general";

export interface VenueRecommendation {
  summary: string;
  kind: RecommendationKind;
}

export interface ExtractedPlace {
  name: string;
  address: string | null;
  rating: number | null;
  location: { latitude: number; longitude: number } | null;
  thumbnail_url: string | null;
  google_place_id: string | null;
  instagram_username: string | null;
  recommendations: VenueRecommendation[];
}

export interface RecognitionTask {
  recognition_id: string;
  status: RecognitionStatus;
  source_url: string;
  result_id: string | null;
  places: ExtractedPlace[] | null;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecognitionResult {
  result_id: string;
  source_url: string;
  video_url: string | null;
  caption: string | null;
  source_type: "reel" | "post" | "story" | "tiktok";
  places: ExtractedPlace[];
  created_at: string;
  updated_at: string;
}

/** One measured HTTP call, as recorded by the server proxy. */
export interface BackendCall<T = unknown> {
  data: T | null;
  raw: unknown;
  status: number;
  ok: boolean;
  durationMs: number;
  method: string;
  path: string;
  error: string | null;
}
