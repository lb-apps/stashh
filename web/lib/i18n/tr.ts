import type { Dictionary } from "./en";

/** Turkish copy. Shape is enforced by `Dictionary` — see en.ts. */
export const tr: Dictionary = {
  locale: "tr-TR",
  common: {
    close: "Kapat",
    back: "Geri",
    retry: "Tekrar dene",
    cancel: "Vazgeç",
    save: "Kaydet",
    done: "Tamam",
    search: "Ara",
    profile: "Profil",
    offline: "Çevrimdışı — kayıtlı mekanların çalışmaya devam ediyor",
    loading: "Yükleniyor",
  },
  categories: {
    coffee: "Kahve",
    food: "Yemek",
    bar: "Bar",
    rooftop: "Teras",
    sweets: "Tatlı",
    bakery: "Fırın",
    wine: "Şarap",
    park: "Park",
    view: "Manzara",
    market: "Pazar",
    default: "Mekan",
  },
  auth: {
    signingIn: "Haritan açılıyor",
    linkInvalidTitle: "Bu link çalışmıyor",
    linkInvalidBody: "Instagram’da @stashh.me’ye “harita” yaz, yenisini gönderelim.",
    signedOutTitle: "Haritan DM’lerinde",
    signedOutBody: "Instagram’da @stashh.me’ye bir Reel gönder. Her cevapta haritanı açan bir link var.",
    openInstagram: "@stashh.me’ye yaz",
    openInBrowserHint: "Haritanı Safari ya da Chrome’da tutmak için ⋯ simgesine dokunup Tarayıcıda aç’ı seç.",
  },
  errors: {
    generic: "Bir şeyler ters gitti. Tekrar dene.",
    network: "Çevrimdışısın. Kayıtlı mekanların çalışmaya devam ediyor.",
    notFound: "Bu artık burada değil.",
  },
};
