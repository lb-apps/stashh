import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Recognition Console · Stashh",
  description: "Internal tool: run the recognition pipeline and inspect its timings.",
  robots: { index: false, follow: false },
};

// Root layout for the internal console. Discovery is light only — no `dark`
// class, no `data-theme`, no `prefers-color-scheme` switch.
export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="console-shell flex min-h-full flex-col text-ink-primary">
        {children}
      </body>
    </html>
  );
}
