import type { Config } from "../config.ts";
import type { HttpClient } from "../lib/http-client.ts";
import type { Logger } from "../lib/logger.ts";
import { discoverFromWebsite, type MenuCandidate } from "./strategies/website.ts";
import { discoverFromSearch } from "./strategies/google-search.ts";
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
  source: "website" | "search" | "instagram" | "none";
}

export async function discoverMenuUrl(
  ctx: DiscoveryContext,
  config: Config,
  httpClient: HttpClient,
  log: Logger,
): Promise<DiscoveryResult> {
  if (ctx.websiteUrl) {
    const candidates = await discoverFromWebsite(ctx.websiteUrl, httpClient, log);
    if (candidates.length > 0) {
      log.info({ placeId: ctx.placeId, count: candidates.length }, "menu candidates from website");
      return { candidates, source: "website" };
    }
  }

  const searchCandidates = await discoverFromSearch(ctx.name, ctx.city, config.GOOGLE_API_KEY, config.GOOGLE_CSE_ID, log);
  if (searchCandidates.length > 0) {
    log.info({ placeId: ctx.placeId, count: searchCandidates.length }, "menu candidates from search");
    return { candidates: searchCandidates, source: "search" };
  }

  if (ctx.instagramUsername) {
    const igCandidates = await discoverFromInstagram(ctx.instagramUsername, httpClient, log);
    if (igCandidates.length > 0) {
      log.info({ placeId: ctx.placeId, count: igCandidates.length }, "menu candidates from instagram");
      return { candidates: igCandidates, source: "instagram" };
    }
  }

  log.info({ placeId: ctx.placeId }, "no menu candidates found");
  return { candidates: [], source: "none" };
}
