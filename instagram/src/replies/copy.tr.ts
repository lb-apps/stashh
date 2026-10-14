import type { RecognitionSource } from "../stashh/client.ts";

/**
 * Every word Stashh says in a DM, in Turkish. Discovery voice: plain, warm, "sen",
 * no emoji, no exclamation marks. Kept in one file so a second language is a copy
 * of this file, not a hunt through the code.
 */

/** What the person shared, so the reply names it the way they would. */
export type SourceKind = "reel" | "video" | "post";

const NOUN: Record<SourceKind, { locative: string; accusative: string }> = {
  reel: { locative: "Reel'de", accusative: "Reel'i" },
  video: { locative: "videoda", accusative: "videoyu" },
  post: { locative: "gönderide", accusative: "gönderiyi" },
};

export function sourceKindOf(source: RecognitionSource): SourceKind {
  if (source.kind === "instagram_media") return "post";
  if (/tiktok\.com/i.test(source.url)) return "video";
  if (/instagram\.com\/(?:[A-Za-z0-9._]+\/)?reels?\//i.test(source.url)) return "reel";
  return "post";
}

const ratingFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const copy = {
  found: (count: number, kind: SourceKind) => `Bu ${NOUN[kind].locative} ${count} mekân var.`,
  empty: (kind: SourceKind) =>
    `Bu ${NOUN[kind].locative} bir mekân bulamadık. Başka bir Reel gönder, içindekileri çıkaralım.`,
  failed: (kind: SourceKind) => `Bu ${NOUN[kind].accusative} şu an okuyamadık. Birazdan tekrar gönderir misin?`,
  help: 'Bir Reel ya da gönderi paylaş, içindeki mekânları sana listeleyelim. Verilerini silmek için "sil" yaz.',
  unsupported:
    "Şimdilik Reel'leri, gönderileri ve Instagram ya da TikTok linklerini okuyabiliyoruz. Bir Reel ya da gönderi paylaş, içindeki mekânları listeleyelim.",
  erased: "Stashh'teki verilerini sildik.",
  openInMaps: "Haritada aç",
  instagram: "Instagram",
  rating: (rating: number) => `★ ${ratingFormat.format(rating)}`,
} as const;
