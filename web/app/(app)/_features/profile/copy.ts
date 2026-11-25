import type { LocationState } from "@/lib/platform/location";
import type { BillingTask, Plan } from "@/lib/stashh/types";

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
    plan: "Plan",
    planName: { free: "Free", premium: "Premium" } satisfies Record<Plan, string>,
    until: (date: string) => `Until ${date}`,
    seePremium: "See Premium",
    leftToday: "Left today",
    credits: "Credits",
    /** Under the allowance once it is used up: when the next one comes back ("in 3 hours"). */
    nextFree: (when: string) => `Your next analysis comes back ${when}`,
    earn: "Earn credits",
    tasks: { first_list: "Make your first list", first_web_visit: "Open your map on the web" } satisfies Record<BillingTask, string>,
    taskCredits: (n: number) => `+${n} ${n === 1 ? "credit" : "credits"}`,
    /** A plain link: following earns nothing (Meta forbids rewarding follows), so nothing here suggests it does. */
    follow: "Follow @stashh.me on Instagram",
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
    plan: "Plan",
    planName: { free: "Ücretsiz", premium: "Premium" },
    until: (date: string) => `${date} tarihine kadar`,
    seePremium: "Premium’a göz at",
    leftToday: "Bugün kalan",
    credits: "Kredi",
    nextFree: (when: string) => `Sıradaki analiz hakkın ${when} açılıyor`,
    earn: "Kredi kazan",
    tasks: { first_list: "İlk listeni oluştur", first_web_visit: "Haritanı web’de aç" },
    taskCredits: (n: number) => `+${n} kredi`,
    follow: "Instagram’da @stashh.me’yi takip et",
    signOut: "Çıkış yap",
    signOutTitle: "Stashh’tan çıkış yapılsın mı?",
    signOutBody: "Mekanların kayıtlı kalır. Geri dönmek için Instagram’da @stashh.me’ye “harita” yaz.",
  },
};
