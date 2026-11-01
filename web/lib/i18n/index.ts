import { en, type Dictionary } from "./en";
import { tr } from "./tr";

export type Locale = "en" | "tr";
export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, tr };

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/**
 * Picks the locale from an Accept-Language header: the first supported
 * language by q-weight, English otherwise. Server-side, so the first paint is
 * already in the reader's language.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return "en";
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.lang && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);
  const hit = ranked.find((entry): entry is { lang: Locale; q: number } => entry.lang in DICTIONARIES);
  return hit?.lang ?? "en";
}
