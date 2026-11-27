import type { BadgeVariantName } from "@/components/ui/badge";
import type { AssistantTurnStatus, Channel, DependencyHealth, DmContent, EvidenceJobStatus, FetchMethod, MentionSource, MenuDiscoveryStatus, RunOutcome, SourceType, TaskStatus } from "./ops-types";
import type { BillingTask, CreditReason, Plan, PlanSource } from "./billing-types";

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

/** Where a part of the reel tied to a place comes from. */
export const MENTION_SOURCE: Record<MentionSource, string> = {
  speech: "Said",
  caption: "Caption",
  on_screen: "On screen",
};

/** The attribution job that ties a reel's speech and caption to its places. */
export const EVIDENCE_JOB_STATUS: Record<EvidenceJobStatus, { label: string; variant: BadgeVariantName }> = {
  queued: { label: "Attribution queued", variant: "warning" },
  running: { label: "Attributing", variant: "info" },
  done: { label: "Attributed", variant: "success" },
  failed: { label: "Attribution failed", variant: "danger" },
};

export const FETCH_METHOD: Record<FetchMethod, string> = {
  scrape: "Instagram page",
  downloader: "Downloader (fallback)",
  tiktok: "TikTok downloader",
  supplied: "From the DM",
  caption: "Caption only",
};

export const DM_CONTENT: Record<DmContent, string> = { reel: "Reel", post: "Post", link: "Link", text: "Text", other: "Other" };

export const INTENT: Record<string, string> = {
  recognize: "Recognition",
  help: "Help",
  unsupported: "Unsupported",
  erase: "Delete data",
  link: "Map link",
  env: "Relay command",
  chat: "Assistant",
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

export const ASSISTANT_STATUS: Record<AssistantTurnStatus, { label: string; variant: BadgeVariantName }> = {
  replied: { label: "Replied", variant: "success" },
  fallback: { label: "Fixed line", variant: "warning" },
  capped: { label: "Daily cap", variant: "secondary" },
  failed: { label: "Failed", variant: "danger" },
};

/** The assistant's tools, in the words of what they do. */
export const ASSISTANT_TOOL: Record<string, string> = {
  get_list_places: "Read a list",
  create_list: "Create a list",
  update_list: "Rename a list",
  delete_list: "Delete a list",
  add_to_list: "Add to a list",
  remove_from_list: "Remove from a list",
  search_saved_places: "Search the library",
  get_recent_recognitions: "Recent shares",
  get_place: "Place details",
  mark_visited: "Mark visited",
  remove_place: "Remove a place",
  get_map_link: "Map link",
};
export const toolLabel = (name: string) => ASSISTANT_TOOL[name] ?? name;

export const MENU_STATUS: Record<MenuDiscoveryStatus, { label: string; variant: BadgeVariantName }> = {
  queued: { label: "Queued", variant: "warning" },
  discovering: { label: "Discovering", variant: "info" },
  scraping: { label: "Scraping", variant: "info" },
  parsing: { label: "Parsing", variant: "info" },
  verifying: { label: "Verifying", variant: "info" },
  done: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  not_found: { label: "Not found", variant: "secondary" },
};

const MENU_TYPES: Record<string, string> = {
  food: "Food",
  drinks: "Drinks",
  desserts: "Desserts",
  hookah: "Hookah",
  services: "Services",
  room_service: "Room service",
  unknown: "Menu",
};

export const menuTypeLabel = (type: string) => MENU_TYPES[type] ?? type;

/* ── Plans and credits ───────────────────────────────────────────────────── */

export const PLAN: Record<Plan, { label: string; variant: BadgeVariantName }> = {
  free: { label: "Free", variant: "secondary" },
  premium: { label: "Premium", variant: "default" },
};

/** Who set a person's plan. */
export const PLAN_SOURCE: Record<PlanSource, string> = {
  default: "never changed",
  mock: "test paywall",
  admin: "set by hand",
  revenuecat: "store purchase",
};

export const BILLING_TASK: Record<BillingTask, string> = { first_list: "First list", first_web_visit: "First web visit" };

const CREDIT_REASON: Record<CreditReason, string> = { task: "Task", purchase: "Purchase", recognition: "Analysis", admin: "By hand" };

/** What credits moved for: the task's name for a reward, the reason otherwise. */
export const creditReasonLabel = (reason: CreditReason, ref: string) =>
  reason === "task" ? (BILLING_TASK[ref as BillingTask] ?? ref) : CREDIT_REASON[reason];

/** A person as the billing views name them: the Instagram handle, or the start of their user id. */
export const personLabel = (username: string | null, userId: string) => (username ? `@${username}` : `User ${userId.slice(0, 8)}`);
