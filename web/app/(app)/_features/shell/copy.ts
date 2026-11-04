/** Copy for the map chrome (header, floating controls). */
export const shellCopy = {
  en: {
    savedHere: (n: number, city: string | null) => [n === 1 ? "1 place saved" : `${n} places saved`, city].filter(Boolean).join(" · "),
    nothingSaved: "Nothing saved yet",
    search: "Search saved places",
    profile: "Profile",
    filter: "Filter places",
    filterActive: "Filter places, a filter is on",
    recenter: "Show my location",
    locationOff: "Location off",
    paste: "Paste a Reel",
    offline: "Offline — saved places still work",
  },
  tr: {
    savedHere: (n: number, city: string | null) => [`${n} mekan kayıtlı`, city].filter(Boolean).join(" · "),
    nothingSaved: "Henüz kayıtlı mekan yok",
    search: "Kayıtlı mekanlarda ara",
    profile: "Profil",
    filter: "Mekanları filtrele",
    filterActive: "Mekanları filtrele, bir filtre açık",
    recenter: "Konumumu göster",
    locationOff: "Konum kapalı",
    paste: "Reel yapıştır",
    offline: "Çevrimdışı — kayıtlı mekanların çalışıyor",
  },
};
