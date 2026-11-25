import type { Logger } from "../../lib/logger.ts";
import { isKnownMenuPlatform, isMenuRelatedUrl } from "../patterns.ts";
import type { MenuCandidate } from "./website.ts";

interface BraveSearchResult {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
}

interface AiRankedUrl {
  url: string;
  confidence: number;
  reason: string;
}

const BLOCKED_TLDS = [".gov", ".gov.tr", ".gov.cn", ".mil", ".edu"];

const BLOCKED_HOSTNAMES = [
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "tripadvisor.com",
  "yelp.com",
  "zomato.com",
  "foursquare.com",
  "google.com",
  "wikipedia.org",
  "reddit.com",
  "pinterest.com",
  "linkedin.com",
];

function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (BLOCKED_TLDS.some((tld) => hostname.endsWith(tld))) return true;
    if (BLOCKED_HOSTNAMES.some((h) => hostname === h || hostname.endsWith(`.${h}`))) return true;
    return false;
  } catch {
    return true;
  }
}

async function searchBrave(
  query: string,
  apiKey: string,
): Promise<BraveSearchResult["web"]> {
  const params = new URLSearchParams({
    q: query,
    country: "TR",
    search_lang: "tr",
    count: "10",
    text_decorations: "false",
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) return undefined;
  const data = (await response.json()) as BraveSearchResult;
  return data.web;
}

function scoreResultsHeuristic(
  results: NonNullable<BraveSearchResult["web"]>["results"],
): MenuCandidate[] {
  const candidates: MenuCandidate[] = [];
  for (const result of results ?? []) {
    if (isBlockedDomain(result.url)) continue;

    const platform = isKnownMenuPlatform(result.url);
    if (platform) {
      candidates.push({ url: result.url, source: "known_platform", confidence: 0.85 });
      continue;
    }

    if (isMenuRelatedUrl(result.url)) {
      candidates.push({ url: result.url, source: "website_link", confidence: 0.6 });
      continue;
    }

    const combined = `${result.title} ${result.description}`.toLowerCase();
    if (combined.includes("menü") || combined.includes("menu") || combined.includes("fiyat")) {
      candidates.push({ url: result.url, source: "website_link", confidence: 0.5 });
    }
  }
  return candidates;
}

async function aiRankResults(
  placeName: string,
  city: string | undefined,
  results: NonNullable<BraveSearchResult["web"]>["results"],
  openrouterKey: string,
  log: Logger,
): Promise<AiRankedUrl[]> {
  if (!results || results.length === 0) return [];

  const filtered = results.filter((r) => !isBlockedDomain(r.url));
  if (filtered.length === 0) return [];

  const resultsText = filtered
    .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.description}`)
    .join("\n\n");

  const prompt = `You are a menu URL finder for restaurants. Given these web search results for "${placeName}"${city ? ` in ${city}` : ""}, identify which URLs are most likely to be the restaurant's actual menu page (food/drink menu with items and prices).

Search results:
${resultsText}

Return a JSON array of the top 3 most likely menu URLs, ranked by confidence. Each item should have:
- "url": the exact URL from the results
- "confidence": 0.0-1.0 (1.0 = definitely a menu page)
- "reason": brief explanation

Only include URLs with confidence >= 0.4. If none look like menu pages, return an empty array.
Return ONLY the JSON array, no other text.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-5.5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, "AI ranking request failed");
      return [];
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      log.info("AI ranking returned empty content");
      return [];
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log.info({ content: content.slice(0, 200) }, "AI ranking returned non-JSON");
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as AiRankedUrl[];
    const valid = parsed.filter((r) => r.url && r.confidence >= 0.4);
    log.info({ count: valid.length, total: parsed.length }, "AI ranking results");
    return valid;
  } catch (error) {
    log.warn({ err: error }, "AI ranking failed, falling back to heuristic");
    return [];
  }
}

export async function discoverFromSearch(
  placeName: string,
  city: string | undefined,
  websiteUrl: string | undefined | null,
  braveApiKey: string | undefined,
  openrouterKey: string,
  log: Logger,
): Promise<MenuCandidate[]> {
  if (!braveApiKey) {
    log.debug("no BRAVE_SEARCH_API_KEY, skipping search discovery");
    return [];
  }

  try {
    // Site-scoped search when we know the place's website
    if (websiteUrl) {
      try {
        const domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
        const cityPart = city ? `${city} ` : "";
        const siteQuery = `site:${domain} ${cityPart}menü OR menu`;
        const siteResults = await searchBrave(siteQuery, braveApiKey);

        if (siteResults?.results && siteResults.results.length > 0) {
          const aiRanked = await aiRankResults(placeName, city, siteResults.results, openrouterKey, log);
          if (aiRanked.length > 0) {
            log.info({ domain, count: aiRanked.length }, "AI-ranked site-scoped results");
            return aiRanked.map((r) => ({
              url: r.url,
              source: "website_link" as const,
              confidence: r.confidence,
            }));
          }

          const heuristic = scoreResultsHeuristic(siteResults.results).filter((c) => c.confidence >= 0.6);
          if (heuristic.length > 0) {
            log.info({ domain, count: heuristic.length }, "heuristic site-scoped results");
            return heuristic.slice(0, 5);
          }
        }
      } catch {
        // site-scoped query failed, fall through to generic
      }
    }

    // Generic search
    const query = city
      ? `${placeName} ${city} menü yemek listesi`
      : `${placeName} menü yemek listesi`;
    const webResults = await searchBrave(query, braveApiKey);

    if (!webResults?.results || webResults.results.length === 0) {
      return [];
    }

    // AI-powered ranking first
    const aiRanked = await aiRankResults(placeName, city, webResults.results, openrouterKey, log);
    if (aiRanked.length > 0) {
      log.info({ count: aiRanked.length }, "AI-ranked generic search results");
      return aiRanked.map((r) => ({
        url: r.url,
        source: "website_link" as const,
        confidence: r.confidence,
      }));
    }

    // Heuristic fallback
    const candidates = scoreResultsHeuristic(webResults.results);
    candidates.sort((a, b) => b.confidence - a.confidence);
    return candidates.filter((c) => c.confidence >= 0.4).slice(0, 5);
  } catch (error) {
    log.warn({ err: error }, "web search error");
    return [];
  }
}
