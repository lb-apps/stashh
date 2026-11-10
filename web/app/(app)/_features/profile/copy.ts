import type { LocationState } from "@/lib/platform/location";

/** Copy for the profile sheet. */
export const profileCopy = {
  en: {
    joined: (monthYear: string) => `Joined ${monthYear}`,
    /** The sticker for the neighbourhood with the most saves. */
    regular: (district: string) => `${district} regular`,
    stats: { places: "Places", lists: "Lists", cities: "Cities" },
    settings: "Settings",
    language: "Language",
    languageHint: "On this device",
    location: "Location",
    locationHint: {
      unknown: "Not asked yet",
      locating: "Finding you…",
      granted: "On — distances are live",
      denied: "Off — distances are hidden",
    } satisfies Record<LocationState["status"], string>,
    turnOn: "Turn on",
    signOut: "Sign out",
    signOutTitle: "Sign out of Stashh?",
    signOutBody: "Your places stay saved. Send “map” to @stashh.me on Instagram to get back in.",
  },
  tr: {
    joined: (monthYear: string) => `Katılım: ${monthYear}`,
    regular: (district: string) => `${district} müdavimi`,
    stats: { places: "Mekan", lists: "Liste", cities: "Şehir" },
    settings: "Ayarlar",
    language: "Dil",
    languageHint: "Bu cihazda geçerli",
    location: "Konum",
    locationHint: {
      unknown: "Henüz sorulmadı",
      locating: "Konumun bulunuyor…",
      granted: "Açık — mesafeler canlı",
      denied: "Kapalı — mesafeler gizli",
    },
    turnOn: "Aç",
    signOut: "Çıkış yap",
    signOutTitle: "Stashh’tan çıkış yapılsın mı?",
    signOutBody: "Mekanların kayıtlı kalır. Geri dönmek için Instagram’da @stashh.me’ye “harita” yaz.",
  },
};
