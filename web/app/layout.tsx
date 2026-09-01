import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stashh",
  description:
    "Paste an Instagram or TikTok link, get the places: saved to lists, live on a map.",
};

// HeroUI v3 needs no provider (unlike v2). Theme is driven by the `dark` class
// and `data-theme` on <html>; `suppressHydrationWarning` lets a theme script
// set those before React hydrates without tripping a mismatch warning.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="console-shell flex min-h-full flex-col text-foreground">
        {children}
      </body>
    </html>
  );
}
