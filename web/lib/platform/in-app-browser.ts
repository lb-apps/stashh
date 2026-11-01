/**
 * In-app browsers (Instagram first: users arrive from a DM) run the page in the
 * host app's own WebView — WKWebView on iOS, an Android WebView — not in Safari
 * or Chrome. Storage there is not shared with the system browser, popups and
 * OAuth are unreliable, and Meta injects scripts. Detection is a plain
 * user-agent check, kept in one place so every caller agrees.
 */
export type InAppBrowser = "instagram" | "facebook" | "tiktok" | null;

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser {
  if (!userAgent) return null;
  if (/\bInstagram\b/.test(userAgent)) return "instagram";
  if (/\bFBAN\/|\bFBAV\/|\bFB_IAB\//.test(userAgent)) return "facebook";
  if (/\bBytedanceWebview\b|\bmusical_ly\b|\bTikTok\b/i.test(userAgent)) return "tiktok";
  return null;
}

export type MobileOS = "ios" | "android" | "other";

export function detectOS(userAgent: string | null | undefined): MobileOS {
  if (!userAgent) return "other";
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent)) return "ios";
  if (/\bAndroid\b/.test(userAgent)) return "android";
  return "other";
}
