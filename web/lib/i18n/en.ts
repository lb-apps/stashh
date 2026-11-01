/**
 * English copy for the Stashh app — the reference dictionary. Every other
 * locale must satisfy `Dictionary`, so a key missing from a translation is a
 * type error, not a blank on screen. Plurals and values are functions.
 */
export const en = {
  locale: "en-US",
  common: {
    close: "Close",
    back: "Back",
    retry: "Try again",
    cancel: "Cancel",
    save: "Save",
    done: "Done",
    search: "Search",
    profile: "Profile",
    offline: "Offline — saved places still work",
    loading: "Loading",
  },
  home: {
    savedCount: (n: number) => (n === 1 ? "1 place saved" : `${n} places saved`),
    nothingSaved: "Nothing saved yet",
  },
  categories: {
    coffee: "Coffee",
    food: "Food",
    bar: "Bar",
    rooftop: "Rooftop",
    sweets: "Sweets",
    bakery: "Bakery",
    wine: "Wine",
    park: "Park",
    view: "View",
    market: "Market",
    default: "Place",
  },
  auth: {
    signingIn: "Opening your map",
    linkExpiredTitle: "That link has expired",
    linkExpiredBody: "Send “map” to @stashh.me on Instagram and we’ll send you a fresh one.",
    signedOutTitle: "Your map lives in your DMs",
    signedOutBody: "Send a Reel to @stashh.me on Instagram. Every reply carries a link that opens your map.",
    openInstagram: "Message @stashh.me",
    openInBrowserHint: "To keep your map in Safari or Chrome, tap ⋯ and choose Open in browser.",
  },
  errors: {
    generic: "Something went wrong. Try again.",
    network: "You’re offline. Saved places still work.",
    notFound: "That isn’t here any more.",
  },
} as const;

type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;
