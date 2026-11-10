"use client";

import * as React from "react";
import { dictionaryFor, type Dictionary, type Locale } from "./index";

const I18nContext = React.createContext<Locale | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext value={locale}>{children}</I18nContext>;
}

/** The active locale, for the one control that changes it. Everything else reads copy through the hooks below. */
export function useLocale(): Locale {
  const locale = React.use(I18nContext);
  if (!locale) throw new Error("i18n hooks must be used inside <I18nProvider>");
  return locale;
}

/** The app-wide dictionary. `const t = useT(); t.common.close` */
export function useT(): Dictionary {
  return dictionaryFor(useLocale());
}

/**
 * A feature's own copy, kept beside the feature: `{ en, tr }` where `tr` is
 * typed against `en`. `const c = useCopy(placeCopy); c.directions`
 */
export function useCopy<T>(copy: { en: T; tr: NoInfer<T> }): T {
  return copy[useLocale()];
}

/** The BCP 47 tag for `Intl` formatting in the active locale. */
export function useIntlLocale(): string {
  return dictionaryFor(useLocale()).locale;
}
