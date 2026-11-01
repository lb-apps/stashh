"use client";

import * as React from "react";
import { dictionaryFor, type Dictionary, type Locale } from "./index";

const I18nContext = React.createContext<Dictionary | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext value={dictionaryFor(locale)}>{children}</I18nContext>;
}

/** The active dictionary. `const t = useT(); t.common.close` */
export function useT(): Dictionary {
  const dictionary = React.use(I18nContext);
  if (!dictionary) throw new Error("useT() must be used inside <I18nProvider>");
  return dictionary;
}
