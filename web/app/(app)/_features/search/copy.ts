/** Copy for the search sheet. */
export const searchCopy = {
  en: {
    placeholder: "Search saved places…",
    results: (n: string, count: number) => (count === 1 ? "1 place" : `${n} places`),
    recentlySaved: "Recently saved",
    noResults: "Nothing here by that name.",
    noResultsHint: "Try a shorter word.",
    clear: "Clear search",
  },
  tr: {
    placeholder: "Kayıtlı mekanlarda ara…",
    results: (n: string) => `${n} mekan`,
    recentlySaved: "Son kaydedilenler",
    noResults: "Bu isimde bir yer yok.",
    noResultsHint: "Daha kısa bir kelime dene.",
    clear: "Aramayı temizle",
  },
};
