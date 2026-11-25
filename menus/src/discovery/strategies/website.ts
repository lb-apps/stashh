import { load, type CheerioAPI } from "cheerio";
import type { HttpClient } from "../../lib/http-client.ts";
import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedLink, isMenuRelatedUrl } from "../patterns.ts";

export interface MenuCandidate {
  url: string;
  source: "website_link" | "website_redirect" | "website_probe" | "website_subpage" | "known_platform";
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

const BLOCKED_HOSTNAMES = [
  "beian.miit.gov.cn",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "tripadvisor.com",
  "yelp.com",
  "google.com",
  "wikipedia.org",
];

function isBlockedHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return BLOCKED_HOSTNAMES.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return true;
  }
}

const NAV_LINK_PATTERNS = [
  /\bdining\b/i,
  /\brestaurant/i,
  /\bfood\b/i,
  /\beat\b/i,
  /\byemek/i,
  /\bmutfak/i,
  /\bkitchen/i,
  /\bgastronom/i,
  /\bbar\b/i,
  /\blounge/i,
  /\bcaf[eé]/i,
  /\bculinary/i,
  /\bbistro/i,
  /\brestoran/i,
];

function isSameOrigin(url: string, base: string): boolean {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function findNavLinks($: CheerioAPI, baseUrl: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  $("a[href]").each((_, el) => {
    if (results.length >= 5) return false;
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (!href) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).href;
    } catch {
      return;
    }

    if (!isSameOrigin(absoluteUrl, baseUrl)) return;
    if (seen.has(absoluteUrl)) return;

    const combined = `${text} ${href}`.toLowerCase();
    if (NAV_LINK_PATTERNS.some((p) => p.test(combined))) {
      seen.add(absoluteUrl);
      results.push(absoluteUrl);
    }
  });

  return results;
}

function scanPageForMenuLinks($: CheerioAPI, pageUrl: string, source: MenuCandidate["source"], baseConfidence: number): MenuCandidate[] {
  const candidates: MenuCandidate[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (!href) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, pageUrl).href;
    } catch {
      return;
    }

    if (isBlockedHost(absoluteUrl)) return;

    const platform = isKnownMenuPlatform(absoluteUrl);
    if (platform) {
      candidates.push({ url: absoluteUrl, source: "known_platform", confidence: Math.min(baseConfidence + 0.1, 0.95) });
      return;
    }

    if (isMenuRelatedLink(text, href)) {
      candidates.push({ url: absoluteUrl, source, confidence: baseConfidence });
    }
  });

  $("iframe[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (!src) return;
    try {
      const absoluteUrl = new URL(src, pageUrl).href;
      if (isKnownMenuPlatform(absoluteUrl) || isMenuRelatedUrl(absoluteUrl)) {
        candidates.push({ url: absoluteUrl, source, confidence: baseConfidence + 0.05 });
      }
    } catch {
      // skip
    }
  });

  return candidates;
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

    // Tier 1: homepage <a> tags
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

      if (isBlockedHost(absoluteUrl)) return;

      const platform = isKnownMenuPlatform(absoluteUrl);
      if (platform) {
        candidates.push({ url: absoluteUrl, source: "known_platform", confidence: 0.95 });
        return;
      }

      if (isMenuRelatedLink(text, href)) {
        candidates.push({ url: absoluteUrl, source: "website_link", confidence: 0.8 });
      }
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      return candidates;
    }

    // Tier 2: homepage <iframe> tags
    $("iframe[src]").each((_, el) => {
      const src = $(el).attr("src");
      if (!src) return;
      try {
        const absoluteUrl = new URL(src, websiteUrl).href;
        if (isBlockedHost(absoluteUrl)) return;
        if (isKnownMenuPlatform(absoluteUrl) || isMenuRelatedUrl(absoluteUrl)) {
          candidates.push({ url: absoluteUrl, source: "website_link", confidence: 0.85 });
        }
      } catch {
        // skip
      }
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      return candidates;
    }

    // Tier 3: crawl nav subpages one level deep (dining, restaurant, bar, etc.)
    const navLinks = findNavLinks($, response.url || websiteUrl);
    if (navLinks.length > 0) {
      log.debug({ count: navLinks.length }, "crawling nav subpages");
      for (const navUrl of navLinks) {
        try {
          const subResponse = await httpClient.fetch(navUrl);
          if (!subResponse.ok) continue;

          const subCt = subResponse.headers.get("content-type") ?? "";
          if (subCt.includes("application/pdf")) {
            candidates.push({ url: navUrl, source: "website_subpage", confidence: 0.8 });
            break;
          }
          if (!subCt.includes("text/html")) continue;

          const subHtml = await subResponse.text();
          const sub$ = load(subHtml);
          const subCandidates = scanPageForMenuLinks(sub$, subResponse.url || navUrl, "website_subpage", 0.75);

          if (subCandidates.length > 0) {
            candidates.push(...subCandidates);
            log.debug({ navUrl, count: subCandidates.length }, "menu candidates from nav subpage");
            break;
          }
        } catch {
          // subpage fetch failed, try next
        }
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      return candidates;
    }

    // Tier 4: probe common paths
    const probed = await probeCommonMenuPaths(response.url || websiteUrl, httpClient, log);
    candidates.push(...probed);
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
