import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stashh.me"),
  title: {
    default: "Stashh",
    template: "%s · Stashh",
  },
  description:
    "Bir Reel'i Instagram'da @stashh'e gönder, içindeki mekânları sana listeleyelim.",
  openGraph: {
    siteName: "Stashh",
    locale: "tr_TR",
    type: "website",
  },
};

// Root layout for the public site (stashh.me). Discovery is light only — no
// `dark` class, no `data-theme`, no `prefers-color-scheme` switch. Each page
// commits to one mode itself: brand (cobalt) or utility (bone).
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${fontVariables} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
