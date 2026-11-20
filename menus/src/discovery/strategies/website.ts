import { load } from "cheerio";
import type { HttpClient } from "../../lib/http-client.ts";
import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedLink, isMenuRelatedUrl } from "../patterns.ts";

export interface MenuCandidate {
  url: string;
  source: "website_link" | "website_redirect" | "website_probe" | "known_platform";
  confidence: number;
}

const COMMON_MENU_PATHS = [
  "/menu", "/menü", "/menu/", "/menus",
  "/yemekler", "/yemek-menusu",
  "/fiyat", "/fiyat-listesi",
  "/our-menu", "/food-menu",
  "/drinks", "/bar-menu", "/cocktails",
  "/menu.pdf",
];

export async function discoverFromWebsite(
  websiteUrl: string,
  httpClient: HttpClient,
  log: Logger,
): Promise<MenuCandidate[]> {
  const candidates: MenuCandidate[] = [];

  try {
    const response = await httpClient.fetch(websiteUrl);
    if (!response.ok) {
      log.debug({ url: websiteUrl, status: response.status }, "website fetch failed");
      return candidates;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      if (contentType.includes("application/pdf")) {
        candidates.push({ url: websiteUrl, source: "website_redirect", confidence: 0.7 });
      }
      return candidates;
    }

    const html = await response.text();
    const $ = load(html);

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim();
      if (!href) return;

      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, websiteUrl).href;
      } catch {
        return;
      }

      const platform = isKnownMenuPlatform(absoluteUrl);
      if (platform) {
        candidates.push({ url: absoluteUrl, source: "known_platform", confidence: 0.95 });
        return;
      }

      if (isMenuRelatedLink(text, href)) {
        candidates.push({ url: absoluteUrl, source: "website_link", confidence: 0.8 });
      }
    });

    if (candidates.length === 0) {
      $("iframe[src]").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;
        try {
          const absoluteUrl = new URL(src, websiteUrl).href;
          if (isKnownMenuPlatform(absoluteUrl) || isMenuRelatedUrl(absoluteUrl)) {
            candidates.push({ url: absoluteUrl, source: "website_link", confidence: 0.85 });
          }
        } catch {
          // skip
        }
      });
    }

    if (candidates.length === 0) {
      const probed = await probeCommonMenuPaths(response.url || websiteUrl, httpClient, log);
      candidates.push(...probed);
    }
  } catch (error) {
    log.debug({ url: websiteUrl, err: error }, "website crawl error");
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}

async function probeCommonMenuPaths(
  baseUrl: string,
  httpClient: HttpClient,
  log: Logger,
): Promise<MenuCandidate[]> {
  const candidates: MenuCandidate[] = [];
  const origin = new URL(baseUrl).origin;

  for (const path of COMMON_MENU_PATHS) {
    if (candidates.length >= 3) break;

    const url = `${origin}${path}`;
    try {
      const res = await httpClient.fetch(url);
      if (!res.ok) continue;

      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/pdf")) {
        log.debug({ url }, "menu PDF probe hit");
        candidates.push({ url, source: "website_probe", confidence: 0.75 });
        continue;
      }

      if (!ct.includes("text/html")) continue;

      const html = await res.text();
      if (html.length < 500) continue;
      if (res.url !== url && new URL(res.url).pathname === new URL(baseUrl).pathname) continue;

      const hasMenuContent = /\b(menu|menü|fiyat|price|₺|TL)\b/i.test(html);
      if (hasMenuContent) {
        log.debug({ url }, "menu path probe hit");
        candidates.push({ url, source: "website_probe", confidence: 0.65 });
      }
    } catch {
      // probe failed, skip
    }
  }

  return candidates;
}
