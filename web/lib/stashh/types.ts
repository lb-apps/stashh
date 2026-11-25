/**
 * Wire types of the Stashh public API (`/api/v1`), field names exactly as the
 * backend sends them. Source of truth: `backend/src/modules/<domain>/openapi.ts`
 * (served at `/openapi.json`). Recognition payloads are shared with the
 * internal console and live in `lib/types.ts`.
 */
import type { ExtractedPlace, RecognitionStatus, VenueRecommendation } from "../types";

export type { ExtractedPlace, RecognitionStatus, VenueRecommendation };

/** Every response: `{ ok, data, meta, error }`. */
export interface Envelope<T> {
  ok: boolean;
  data: T | null;
  meta: {
    request_id: string;
    pagination: { limit: number; next_cursor: string | null; has_more: boolean } | null;
  } | null;
  error: { code: string; message: string; details?: unknown } | null;
}

/** Discovery's pin categories; the backend maps Google `primaryType` onto them. */
export type CategoryGroup =
  | "coffee"
  | "food"
  | "bar"
  | "rooftop"
  | "sweets"
  | "bakery"
  | "wine"
  | "park"
  | "view"
  | "market"
  | "default";

export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * One Google Places (New) `regularOpeningHours.periods[]` entry — the only
 * hours the API stores (as the flat array). Day 0 is Sunday; no `close`
 * means open around the clock.
 */
export interface OpeningPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

export type SourceType = "reel" | "post" | "story" | "tiktok";

/** The post a place was saved from. `url` is null for a post shared inside a DM. */
export interface PlaceSource {
  url: string | null;
  type: SourceType | null;
  thumbnail_url: string | null;
  author_username: string | null;
}

export interface SavedPlace {
  id: string;
  google_place_id: string | null;
  name: string;
  address: string | null;
  short_formatted_address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  location: LatLng | null;
  category: string | null;
  category_group: CategoryGroup;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  thumbnail_url: string | null;
  website_url: string | null;
  phone_number: string | null;
  google_maps_uri: string | null;
  business_status: string | null;
  opening_hours: OpeningPeriod[] | null;
  /** Null until the place is re-enriched from Google; see `isOpenNow`. */
  utc_offset_minutes: number | null;
  instagram_username: string | null;
  recommendations: VenueRecommendation[];
  notes: string | null;
  saved_at: string;
  visited_at: string | null;
  list_ids: string[];
  source: PlaceSource | null;
}

export interface ListSummary {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  cover_category: CategoryGroup | null;
  created_at: string;
  updated_at: string;
  place_count: number;
}

export type RecognitionStage = "fetching" | "analyzing" | "matching" | "saving";

export interface Recognition {
  recognition_id: string;
  status: RecognitionStatus;
  stage: RecognitionStage | null;
  source_url: string;
  result_id: string | null;
  places: ExtractedPlace[] | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface RecentRecognition {
  recognition_id: string;
  status: RecognitionStatus;
  stage: RecognitionStage | null;
  source_url: string;
  source_type: SourceType | null;
  source_thumbnail_url: string | null;
  author_username: string | null;
  result_id: string | null;
  place_count: number;
  created_at: string;
  finished_at: string | null;
}

export interface Me {
  user_id: string;
  display_name: string | null;
  instagram_username: string | null;
  created_at: string;
  saved_count: number;
}

export type Plan = "free" | "premium";

/** Things people do in the product that earn credits once. */
export type BillingTask = "first_list" | "first_web_visit";

export type PremiumPeriod = "monthly" | "yearly";

/** Credits a task has just earned. */
export interface TaskReward {
  task: BillingTask;
  credits: number;
}

/**
 * GET /billing: what the plan allows right now. Every plan has a daily
 * allowance (rolling 24 h); past it an analysis spends 1 credit. Only an
 * analysis that finds a place counts.
 */
export interface BillingStatus {
  plan: Plan;
  plan_source: "default" | "mock" | "admin" | "revenuecat";
  /** When Premium ends; null on free, or for Premium until changed. */
  plan_expires_at: string | null;
  store: string | null;
  daily_limit: number;
  used_today: number;
  /** Each plan's daily allowance, for the paywall's comparison. */
  plan_limits: Record<Plan, number>;
  /** When the next free analysis comes back; null while one is available. */
  next_free_at: string | null;
  /** Credits that can be spent now. */
  credits: number;
  /** The paywall grants Premium without payment (owner testing). */
  mock_purchases: boolean;
  /** A switched-off task is listed only once earned. */
  tasks: Array<TaskReward & { done: boolean }>;
}

export interface AddPlacesResult {
  /** `created` is false when the place was already saved (a no-op). */
  results: Array<{ google_place_id: string; place_id: string; created: boolean }>;
}
