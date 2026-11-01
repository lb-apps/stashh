/** Copy for the place cards, tiles and rows. */
export const placeCopy = {
  en: {
    open: "Open",
    closed: "Closed",
    /** Spoken name of the star rating. */
    rated: (rating: string) => `Rated ${rating}`,
  },
  tr: {
    open: "Açık",
    closed: "Kapalı",
    rated: (rating: string) => `${rating} puan`,
  },
};
