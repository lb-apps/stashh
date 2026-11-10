import { en, type Dictionary } from "./en";
import { tr } from "./tr";

export type Locale = "en" | "tr";
export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { en, tr };

/** Stashh speaks Turkish unless the reader picks English in Settings. */
export const DEFAULT_LOCALE: Locale = "tr";
/** The reader's pick, per device. Read on the server, so the first paint is already in it. */
export const LOCALE_COOKIE = "stashh-locale";

export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && Object.hasOwn(DICTIONARIES, value);
}

/** The reader's language: their pick from Settings, Turkish otherwise. The browser's language is not consulted. */
export function resolveLocale(cookie: string | undefined): Locale {
  return isLocale(cookie) ? cookie : DEFAULT_LOCALE;
}
