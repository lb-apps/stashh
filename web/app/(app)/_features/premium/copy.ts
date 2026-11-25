import type { Plan, PremiumPeriod } from "@/lib/stashh/types";

/**
 * Copy for the Premium sheet. The headline and the two rule lines were drafted
 * with content-writer (Apple voice) and reviewed; the rest is microcopy.
 */
export const premiumCopy = {
  en: {
    title: "Premium",
    headline: "More Reels become places on your map each day.",
    plans: { free: "Free", premium: "Premium" } satisfies Record<Plan, string>,
    perDay: "analyses a day",
    allowance: "Only analyses that find places count; empty or failed ones are free.",
    credits: "Once your daily allowance runs out, each analysis uses 1 credit.",
    period: "Billing period",
    periods: { monthly: "Monthly", yearly: "Yearly" } satisfies Record<PremiumPeriod, string>,
    cta: "Get Premium",
    soon: "Premium is coming soon",
    onPremium: "You’re on Premium.",
    until: (date: string) => `Until ${date}`,
  },
  tr: {
    title: "Premium",
    headline: "Her gün daha çok Reel haritanda mekana dönüşür.",
    plans: { free: "Ücretsiz", premium: "Premium" },
    perDay: "günlük analiz",
    allowance: "Sadece mekan bulan analiz sayılır; boşsa ya da hata verirse ücretsiz.",
    credits: "Günlük hakkın bitince her analiz 1 kredi kullanır.",
    period: "Ödeme dönemi",
    periods: { monthly: "Aylık", yearly: "Yıllık" },
    cta: "Premium’a geç",
    soon: "Premium çok yakında geliyor",
    onPremium: "Premium’dasın.",
    until: (date: string) => `${date} tarihine kadar`,
  },
};
