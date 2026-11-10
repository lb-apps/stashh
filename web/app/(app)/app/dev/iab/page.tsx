import { notFound } from "next/navigation";
import { isDeviceName } from "./devices";
import { InstagramBrowser } from "./instagram-browser";

/**
 * Development only: the app inside a mock of Instagram's iOS in-app browser.
 * `?device=iphone-16 | iphone-16-pro-max | iphone-se` picks the screen;
 * `?inset=<points>` overrides the home-bar inset the webview reports.
 */
export default async function InstagramBrowserPage({ searchParams }: PageProps<"/app/dev/iab">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { device, inset } = await searchParams;
  const bottomInset = typeof inset === "string" && /^\d+$/.test(inset) ? Number(inset) : undefined;
  return <InstagramBrowser device={isDeviceName(device) ? device : "iphone-16"} bottomInset={bottomInset} />;
}
