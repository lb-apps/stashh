import type { BadgeVariantName } from "@/components/ui/badge";
import type { Channel, DmContent, FetchMethod, RunOutcome, SourceType, TaskStatus } from "./ops-types";

/** Every name the dashboard gives to the system's states, in one place. */

export const SOURCE_TYPE: Record<SourceType, string> = {
  reel: "Reel",
  post: "Gönderi",
  igtv: "IGTV",
  tiktok: "TikTok",
  shared_post: "DM gönderisi",
};

export const CHANNEL: Record<Channel, string> = { app: "Uygulama", instagram: "Instagram DM" };

export const TASK_STATUS: Record<TaskStatus, { label: string; variant: BadgeVariantName }> = {
  queued: { label: "Kuyrukta", variant: "warning" },
  processing: { label: "İşleniyor", variant: "info" },
  completed: { label: "Tamamlandı", variant: "success" },
  committed: { label: "Kaydedildi", variant: "success" },
  failed: { label: "Başarısız", variant: "danger" },
  cancelled: { label: "İptal", variant: "secondary" },
  expired: { label: "Süresi doldu", variant: "secondary" },
};

export const RUN_OUTCOME: Record<RunOutcome, { label: string; variant: BadgeVariantName }> = {
  completed: { label: "Yeni işlem", variant: "info" },
  cache_hit: { label: "Cache", variant: "secondary" },
  failed: { label: "Hata", variant: "danger" },
};

export const FETCH_METHOD: Record<FetchMethod, string> = {
  scrape: "Instagram sayfası",
  downloader: "İndirici (yedek)",
  tiktok: "TikTok indirici",
  supplied: "DM'den geldi",
};

export const DM_CONTENT: Record<DmContent, string> = { reel: "Reel", post: "Gönderi", link: "Link", text: "Yazı", other: "Diğer" };

const STEPS: Record<string, string> = {
  "content fetched": "İçerik alma",
  "media analyzed": "Model",
  "places found": "Google eşleşme",
  "thumbnails saved": "Görseller",
  "result saved": "Kaydetme",
  "cache checked": "Cache kontrolü",
  "served from cache": "Cache",
};

export const stepLabel = (step: string | null | undefined) => (step ? (STEPS[step] ?? step) : "—");
