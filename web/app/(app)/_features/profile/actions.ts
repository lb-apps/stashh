"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";

/** The pick outlives any session; like the other settings it belongs to this device. */
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Saves the reader's language on this device. Next re-renders the app in it on the same round trip. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/app",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
