import type { BadgeVariantName } from "@/components/ui/badge";
import type { Channel, DependencyHealth, DmContent, FetchMethod, RunOutcome, SourceType, TaskStatus } from "./ops-types";

type DependencyKey = DependencyHealth["key"];

/** Every name the dashboard gives to the system's states, in one place. */

export const SOURCE_TYPE: Record<SourceType, string> = {
  reel: "Reel",
  post: "Post",
  igtv: "IGTV",
  tiktok: "TikTok",
  shared_post: "DM post",
};

export const CHANNEL: Record<Channel, string> = { app: "App", instagram: "Instagram" };

export const TASK_STATUS: Record<TaskStatus, { label: string; variant: BadgeVariantName }> = {
  queued: { label: "Queued", variant: "warning" },
  processing: { label: "Processing", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  committed: { label: "Saved", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  expired: { label: "Expired", variant: "secondary" },
};

export const RUN_OUTCOME: Record<RunOutcome, { label: string; variant: BadgeVariantName }> = {
  completed: { label: "Fresh run", variant: "info" },
  cache_hit: { label: "Cache", variant: "secondary" },
  failed: { label: "Failed", variant: "danger" },
};

export const FETCH_METHOD: Record<FetchMethod, string> = {
  scrape: "Instagram page",
  downloader: "Downloader (fallback)",
  tiktok: "TikTok downloader",
  supplied: "From the DM",
};

export const DM_CONTENT: Record<DmContent, string> = { reel: "Reel", post: "Post", link: "Link", text: "Text", other: "Other" };

export const INTENT: Record<string, string> = {
  recognize: "Recognition",
  help: "Help",
  unsupported: "Unsupported",
  erase: "Delete data",
};

export const intentLabel = (intent: string | null) => (intent ? (INTENT[intent] ?? intent) : "Unknown");

const STEPS: Record<string, string> = {
  "content fetched": "Content fetch",
  "media analyzed": "Model",
  "places found": "Google match",
  "thumbnails saved": "Photos",
  "result saved": "Save",
  "cache checked": "Cache check",
  "served from cache": "Cache",
};

export const DEPENDENCY: Record<DependencyKey, { label: string; detail: string }> = {
  instagram_fetch: { label: "Instagram", detail: "Reading the post or Reel" },
  tiktok_fetch: { label: "TikTok", detail: "Reading the video or photos" },
  model: { label: "Model", detail: "OpenRouter, finding the places" },
  places: { label: "Google Places", detail: "Matching each place" },
  storage: { label: "Photo storage", detail: "Saving covers and place photos" },
  database: { label: "Database", detail: "Saving the result" },
};

export const stepLabel = (step: string | null | undefined) => (step ? (STEPS[step] ?? step) : "—");
