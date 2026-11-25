import type { Config } from "../config.ts";
import type { HttpClient } from "../lib/http-client.ts";
import type { Logger } from "../lib/logger.ts";
import { discoverFromWebsite, type MenuCandidate } from "./strategies/website.ts";
import { discoverFromSearch } from "./strategies/web-search.ts";
import { discoverFromInstagram } from "./strategies/instagram.ts";

export interface DiscoveryContext {
  placeId: string;
  name: string;
  city?: string;
  websiteUrl?: string | null;
  instagramUsername?: string | null;
}

export interface DiscoveryResult {
  candidates: MenuCandidate[];
  source: "website" | "search" | "instagram" | "merged" | "none";
}

const HIGH_CONFIDENCE = 0.7;
const MIN_CONFIDENCE = 0.4;

function deduplicateByUrl(candidates: MenuCandidate[]): MenuCandidate[] {
  const best = new Map<string, MenuCandidate>();
  for (const c of candidates) {
    const existing = best.get(c.url);
    if (!existing || c.confidence > existing.confidence) {
      best.set(c.url, c);
    }
  }
  return [...best.values()].sort((a, b) => b.confidence - a.confidence);
}

export async function discoverMenuUrl(
  ctx: DiscoveryContext,
  config: Config,
  httpClient: HttpClient,
  log: Logger,
): Promise<DiscoveryResult> {
  let websiteCandidates: MenuCandidate[] = [];

  // Website crawl (homepage + nav subpages + path probing)
  if (ctx.websiteUrl) {
    websiteCandidates = (await discoverFromWebsite(ctx.websiteUrl, httpClient, log))
      .filter((c) => c.confidence >= MIN_CONFIDENCE);

    if (websiteCandidates.length > 0) {
      const best = websiteCandidates[0]!.confidence;
      if (best >= HIGH_CONFIDENCE) {
        log.info({ placeId: ctx.placeId, count: websiteCandidates.length, best }, "high-confidence website candidates");
        return { candidates: websiteCandidates, source: "website" };
      }
      log.info({ placeId: ctx.placeId, best }, "low-confidence website candidates, also running search");
    }
  }

  // Web search (Brave + AI ranking) — always runs unless website already high-confidence
  const searchCandidates = (await discoverFromSearch(
    ctx.name, ctx.city, ctx.websiteUrl, config.BRAVE_SEARCH_API_KEY, config.OPENROUTER_API_KEY, log,
  )).filter((c) => c.confidence >= MIN_CONFIDENCE);

  // Merge website + search when both produced results
  if (websiteCandidates.length > 0 || searchCandidates.length > 0) {
    const merged = deduplicateByUrl([...websiteCandidates, ...searchCandidates]);
    const source = websiteCandidates.length > 0 && searchCandidates.length > 0
      ? "merged" as const
      : websiteCandidates.length > 0 ? "website" as const : "search" as const;
    log.info({ placeId: ctx.placeId, count: merged.length, source }, "menu candidates after merge");
    return { candidates: merged, source };
  }

  // Instagram bio fallback
  if (ctx.instagramUsername) {
    const igCandidates = (await discoverFromInstagram(ctx.instagramUsername, httpClient, log))
      .filter((c) => c.confidence >= MIN_CONFIDENCE);
    if (igCandidates.length > 0) {
      log.info({ placeId: ctx.placeId, count: igCandidates.length }, "menu candidates from instagram");
      return { candidates: igCandidates, source: "instagram" };
    }
  }

  log.info({ placeId: ctx.placeId }, "no menu candidates found");
  return { candidates: [], source: "none" };
}
