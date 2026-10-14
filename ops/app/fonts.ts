import { Figtree } from "next/font/google";

// Same faces as web/app/fonts.ts: Apple devices render SF Pro through the
// -apple-system stack in the Discovery font tokens; Figtree stands in elsewhere.
// `latin-ext` carries Turkish.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin", "latin-ext"], display: "swap" });

export const fontVariables = figtree.variable;
