import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { fontVariables } from "../fonts";
import { negotiateLocale } from "@/lib/i18n";
import { detectInAppBrowser, detectOS } from "@/lib/platform/in-app-browser";
import { Providers } from "./_components/providers";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://stashh.me"),
  title: "Stashh",
  robots: { index: false, follow: false },
};

// The app owns the whole screen: content runs under the notch and home bar
// (padded with safe-area insets), and the keyboard resizes the layout instead
// of panning it, so the sheet stays above it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// Root layout for the signed-in app (stashh.me/app). Utility mode, light only.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const locale = negotiateLocale(requestHeaders.get("accept-language"));

  return (
    <html lang={locale} className={`${fontVariables} app-document`}>
      <body className="ds-mode-utility">
        {/* Meta's in-app browser skips injecting its pcm/autofill SDKs when these exist. */}
        <span id="iab-pcm-sdk" hidden />
        <span id="iab-autofill-sdk" hidden />
        <Providers locale={locale} platform={{ inAppBrowser: detectInAppBrowser(userAgent), os: detectOS(userAgent) }}>
          <div className="app-root">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
