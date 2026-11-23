import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedUrl } from "../patterns.ts";
import type { MenuCandidate } from "./website.ts";

interface GoogleSearchResponse {
  items?: Array<{
    title: string;
    link: string;
    snippet?: string;
  }>;
}

export async function discoverFromSearch(
  placeName: string,
  city: string | undefined,
  apiKey: string | undefined,
  cseId: string | undefined,
  log: Logger,
): Promise<MenuCandidate[]> {
  if (!apiKey || !cseId) {
    log.debug("no GOOGLE_API_KEY or GOOGLE_CSE_ID, skipping search discovery");
    return [];
  }

  const query = city ? `${placeName} ${city} menü` : `${placeName} menü`;

  try {
    const params = new URLSearchParams({
      key: apiKey,
      cx: cseId,
      q: query,
      gl: "tr",
      hl: "tr",
      num: "10",
    });

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn({ status: response.status, query }, "Google Custom Search failed");
      return [];
    }

    const data = (await response.json()) as GoogleSearchResponse;
    const candidates: MenuCandidate[] = [];

    for (const result of data.items ?? []) {
      const platform = isKnownMenuPlatform(result.link);
      if (platform) {
        candidates.push({ url: result.link, source: "known_platform", confidence: 0.85 });
        continue;
      }

      if (isMenuRelatedUrl(result.link)) {
        candidates.push({ url: result.link, source: "website_link", confidence: 0.6 });
        continue;
      }

      const combined = `${result.title} ${result.snippet ?? ""}`.toLowerCase();
      if (combined.includes("menü") || combined.includes("menu") || combined.includes("fiyat")) {
        candidates.push({ url: result.link, source: "website_link", confidence: 0.5 });
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates.slice(0, 5);
  } catch (error) {
    log.warn({ err: error, query }, "Google Custom Search error");
    return [];
  }
}
