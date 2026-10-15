import type { RecognitionPlace, TaskStatus } from "./ops-types";

/** `POST /api/v1/recognitions` → 202. */
export interface RecognitionAccepted {
  recognition_id: string;
  status: TaskStatus;
  created_at: string;
}

/** `GET /api/v1/recognitions/{id}`: the task and, once it has one, its result's places. */
export interface RecognitionStatus {
  recognition_id: string;
  status: TaskStatus;
  source_url: string;
  result_id: string | null;
  places: RecognitionPlace[] | null;
  /** The post presents several venues whose names were not in what the model read. */
  names_elsewhere: boolean;
  error_message: string | null;
  retry_count: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

const TERMINAL: ReadonlySet<TaskStatus> = new Set(["completed", "committed", "failed", "cancelled", "expired"]);

export const isTerminal = (status: TaskStatus): boolean => TERMINAL.has(status);

/** Links the backend accepts; kept in step with backend/src/modules/recognitions/types.ts. */
const INSTAGRAM_PERMALINK = /^https?:\/\/(?:www\.)?instagram\.com\/(?:[A-Za-z0-9._]+\/)?(?:p|reels?|tv)\/[A-Za-z0-9_-]+/i;
const TIKTOK_URL = /^https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\//i;

export const isSupportedLink = (url: string): boolean => INSTAGRAM_PERMALINK.test(url) || TIKTOK_URL.test(url);

export interface Preset {
  label: string;
  /** What the link exercises, so a tester knows what to expect. */
  detail: string;
  url: string;
}

/**
 * One link per case, taken from real shares to @stashh. Stories and posts shared from
 * the Instagram app carry no public link, so those are tested by sharing to the account.
 */
export const PRESETS: Preset[] = [
  { label: "Reel", detail: "one venue, address in the caption", url: "https://www.instagram.com/reel/Dd31ojZOgKL/" },
  { label: "Reel · list of 10", detail: "İstanbul must-visit list", url: "https://www.instagram.com/reel/DTCwF_CjFSB/" },
  { label: "Reel · list of 7", detail: "Kadıköy desserts", url: "https://www.instagram.com/reel/Dc3SG2kqU_W/" },
  { label: "Reel · abroad", detail: "Athens, venue name in Greek", url: "https://www.instagram.com/reel/DTQTdKJDEdI/" },
  { label: "TikTok", detail: "Kadıköy, address in the caption", url: "https://vt.tiktok.com/ZSgeFUctL" },
  { label: "TikTok · abroad", detail: "Manchester", url: "https://www.tiktok.com/@shezcooks/video/7386980575795563809" },
];
