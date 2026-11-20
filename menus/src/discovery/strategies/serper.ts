import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedUrl } from "../patterns.ts";
import type { MenuCandidate } from "./website.ts";

interface SerperResult {
  organic?: Array<{
    title: string;
    link: string;
    snippet?: string;
  }>;
}

export async function discoverFromSearch(
  placeName: string,
  city: string | undefined,
  apiKey: string,
  log: Logger,
): Promise<MenuCandidate[]> {
  const query = city ? `${placeName} ${city} menü` : `${placeName} menü`;

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, gl: "tr", hl: "tr", num: 10 }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log.warn({ status: response.status, query }, "Serper search failed");
      return [];
    }

    const data = (await response.json()) as SerperResult;
    const candidates: MenuCandidate[] = [];

    for (const result of data.organic ?? []) {
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
    log.warn({ err: error, query }, "Serper search error");
    return [];
  }
}
