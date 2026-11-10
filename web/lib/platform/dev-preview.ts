/**
 * Development only: `/app/dev/iab` frames the app in a mock of Instagram's iOS
 * in-app browser. A framed document arrives with `Sec-Fetch-Dest: iframe`, and
 * only that request is read as Instagram on an iPhone, so the frame gets the
 * platform the real in-app browser would. Top-level pages keep the browser's own
 * user agent. Never applies in production.
 */
const INSTAGRAM_IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 380.0.0.29.109 (iPhone17,3; iOS 18_5; en_US; en; scale=3.00; 1179x2556; 0)";

export function previewUserAgent(headers: Pick<Headers, "get">): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return headers.get("sec-fetch-dest") === "iframe" ? INSTAGRAM_IOS_USER_AGENT : null;
}
