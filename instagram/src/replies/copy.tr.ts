import type { Recognition, RecognitionSource } from "../stashh/client.ts";

/**
 * Every word Stashh says in a DM, in Turkish. Discovery voice: plain, warm, "sen",
 * no emoji, no exclamation marks. Kept in one file so a second language is a copy
 * of this file, not a hunt through the code.
 */

/** What the person shared, so the reply names it the way they would. */
export type SourceKind = "reel" | "video" | "post" | "story";

const NOUN: Record<SourceKind, { nominative: string; locative: string; accusative: string }> = {
  reel: { nominative: "Reel", locative: "Reel'de", accusative: "Reel'i" },
  video: { nominative: "video", locative: "videoda", accusative: "videoyu" },
  post: { nominative: "gönderi", locative: "gönderide", accusative: "gönderiyi" },
  story: { nominative: "hikâye", locative: "hikâyede", accusative: "hikâyeyi" },
};

/** Where the shared thing lives; a "video" is a TikTok link. */
const platformOf = (kind: SourceKind) => (kind === "video" ? "TikTok" : "Instagram");

export function sourceKindOf(source: RecognitionSource): SourceKind {
  if (source.kind === "instagram_media") return source.format;
  if (/tiktok\.com/i.test(source.url)) return "video";
  if (/instagram\.com\/(?:[A-Za-z0-9._]+\/)?reels?\//i.test(source.url)) return "reel";
  return "post";
}

const ratingFormat = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const copy = {
  found: (count: number, kind: SourceKind) => `Bu ${NOUN[kind].locative} ${count} mekân var, hepsini haritana ekledik.`,
  empty: (kind: SourceKind) =>
    `Bu ${NOUN[kind].locative} bir mekân bulamadık. Başka bir Reel gönder, içindekileri çıkaralım.`,
  failed: (kind: SourceKind) => `Bu ${NOUN[kind].accusative} okurken bir sorun çıktı. Birazdan tekrar gönderir misin?`,
  /** The reply for a failed recognition, worded from the backend's `error_code`. */
  failedBecause: (code: Recognition["error_code"], kind: SourceKind): string => {
    if (code === "private")
      return `Bu ${NOUN[kind].nominative} gizli bir hesaptan, açamadık. Herkese açık bir ${NOUN[kind].nominative} gönderirsen içindeki mekânları çıkarırız.`;
    if (code === "temporarily_unavailable")
      return `${platformOf(kind)} bu ${NOUN[kind].accusative} şu an bize açmıyor. Birkaç dakika sonra tekrar gönderir misin?`;
    return copy.failed(kind);
  },
  listNeedsLink:
    "Bu bir liste gönderisi, diğer sayfalarını göremiyoruz. Gönderinin linkini paylaşırsan hepsini çıkaralım: gönderide Paylaş, sonra Bağlantıyı kopyala.",
  help: 'Bir Reel, gönderi ya da hikâye paylaş, içindeki mekânları sana listeleyelim ve haritana ekleyelim. Haritanı açmak için "harita", verilerini silmek için "sil" yaz.',
  unsupported:
    "Şimdilik Reel'leri, gönderileri, hikâyeleri ve Instagram ya da TikTok linklerini okuyabiliyoruz. Bir Reel, gönderi ya da hikâye paylaş, içindeki mekânları listeleyelim.",
  erased: "Stashh'teki verilerini sildik.",
  /** With a fresh sign-in link, when someone writes "harita". */
  mapLink: "Kaydettiğin mekânlar haritanda. Bu link sadece sana özel, yedi gün içinde bir kez açılır.",
  /** The personal sign-in link to the web map. */
  openMyMap: "Haritanda aç",
  /** A card's link to the place on Google Maps. */
  openInMaps: "Google Maps'te aç",
  instagram: "Instagram",
  rating: (rating: number) => `★ ${ratingFormat.format(rating)}`,
} as const;
