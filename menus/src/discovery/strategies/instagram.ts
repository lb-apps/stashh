import { load } from "cheerio";
import type { HttpClient } from "../../lib/http-client.ts";
import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedUrl } from "../patterns.ts";
import type { MenuCandidate } from "./website.ts";

const LINK_AGGREGATORS = ["linktr.ee", "linkin.bio", "beacons.ai", "bio.link", "tap.bio", "campsite.bio"];

export async function discoverFromInstagram(
  username: string,
  httpClient: HttpClient,
  log: Logger,
): Promise<MenuCandidate[]> {
  const profileUrl = `https://www.instagram.com/${username}/`;
  const candidates: MenuCandidate[] = [];

  try {
    const response = await httpClient.fetch(profileUrl);
    if (!response.ok) return candidates;

    const html = await response.text();
    const bioLinks = extractBioLinks(html);

    for (const link of bioLinks) {
      const platform = isKnownMenuPlatform(link);
      if (platform) {
        candidates.push({ url: link, source: "known_platform", confidence: 0.9 });
        continue;
      }

      if (isLinkAggregator(link)) {
        const aggregatorLinks = await crawlAggregator(link, httpClient, log);
        for (const aLink of aggregatorLinks) {
          if (isKnownMenuPlatform(aLink)) {
            candidates.push({ url: aLink, source: "known_platform", confidence: 0.85 });
          } else if (isMenuRelatedUrl(aLink)) {
            candidates.push({ url: aLink, source: "website_link", confidence: 0.7 });
          }
        }
        continue;
      }

      if (isMenuRelatedUrl(link)) {
        candidates.push({ url: link, source: "website_link", confidence: 0.75 });
      }
    }
  } catch (error) {
    log.debug({ username, err: error }, "instagram bio crawl error");
  }

  return candidates;
}

function extractBioLinks(html: string): string[] {
  const links: string[] = [];
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  let match;
  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[0]!;
    if (!url.includes("instagram.com") && !url.includes("facebook.com") && !url.includes("cdninstagram.com")) {
      links.push(url);
    }
  }
  return [...new Set(links)];
}

function isLinkAggregator(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return LINK_AGGREGATORS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

async function crawlAggregator(url: string, httpClient: HttpClient, log: Logger): Promise<string[]> {
  try {
    const response = await httpClient.fetch(url);
    if (!response.ok) return [];

    const html = await response.text();
    const $ = load(html);
    const links: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href?.startsWith("http") && !href.includes("linktr.ee") && !href.includes("beacons.ai")) {
        links.push(href);
      }
    });

    return links;
  } catch (error) {
    log.debug({ url, err: error }, "aggregator crawl error");
    return [];
  }
}
