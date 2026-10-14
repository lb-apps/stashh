import { Figtree, Nunito } from "next/font/google";

// SF Pro cannot be served from a public website (Apple's licence), so it is
// never downloaded: Apple devices render their installed copy through the
// `-apple-system` stacks in lib/discovery/tokens/fonts.css. These two are the
// stand-ins everywhere else — Figtree for display/text, Nunito for the rounded
// numerals. Both are variable fonts, so no weight list is needed. `latin-ext`
// carries Turkish (ğ ş ı İ).
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Only large numerals use the rounded face, and the public pages have none —
// so it is fetched on use, not preloaded on every page.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

/** Class names that define `--font-figtree` / `--font-nunito` on <html>. */
export const fontVariables = `${figtree.variable} ${nunito.variable}`;
