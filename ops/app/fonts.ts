import { Figtree, Nunito } from "next/font/google";

// Same faces as web/app/fonts.ts: Apple devices render SF Pro (and SF Pro Rounded)
// through the -apple-system / ui-rounded stacks in the Discovery font tokens; Figtree
// and Nunito stand in elsewhere. `latin-ext` carries Turkish captions.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin", "latin-ext"], display: "swap" });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext"], display: "swap", preload: false });

export const fontVariables = `${figtree.variable} ${nunito.variable}`;
