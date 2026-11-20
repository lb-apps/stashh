import { load } from "cheerio";
import type { HttpClient } from "../../lib/http-client.ts";
import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedLink, isMenuRelatedUrl } from "../patterns.ts";

export interface MenuCandidate {
  url: string;
  source: "website_link" | "website_redirect" | "known_platform";
  confidence: number;
}

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
  } catch (error) {
    log.debug({ url: websiteUrl, err: error }, "website crawl error");
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}
