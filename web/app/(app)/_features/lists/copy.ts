/** Copy for the list detail sheet. */
export const listCopy = {
  en: {
    places: (n: string, count: number) => (count === 1 ? "1 place" : `${n} places`),
    empty: "Nothing in this list yet.",
    /** Spoken name of a row's "been there" toggle. */
    beenTo: (name: string) => `Been to ${name}`,
  },
  tr: {
    places: (n: string) => `${n} mekan`,
    empty: "Bu listede henüz mekan yok.",
    beenTo: (name: string) => `Gittim: ${name}`,
  },
};
