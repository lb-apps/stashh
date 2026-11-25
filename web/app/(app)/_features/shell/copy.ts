import type { BillingTask } from "@/lib/stashh/types";

/** Copy for the app's chrome: the + button and what it opens, the profile sheet's name, the credits note. */
export const shellCopy = {
  en: {
    profile: "Profile",
    premium: "Premium",
    /** The note that drops in when a task's credits come in, and what earned them. */
    earned: (n: number) => `You earned ${n} ${n === 1 ? "credit" : "credits"}`,
    earnedFor: { first_list: "For your first list", first_web_visit: "For opening your map on the web" } satisfies Record<BillingTask, string>,
    create: "Create",
    createTitle: "What do you want to create?",
    createList: "List",
    createListSub: "Keep places that go together",
  },
  tr: {
    profile: "Profil",
    premium: "Premium",
    earned: (n: number) => `${n} kredi kazandın`,
    earnedFor: { first_list: "İlk listen için", first_web_visit: "Haritanı web’de açtığın için" },
    create: "Oluştur",
    createTitle: "Ne oluşturmak istersin?",
    createList: "Liste",
    createListSub: "Birlikte gidecek mekanları topla",
  },
};
