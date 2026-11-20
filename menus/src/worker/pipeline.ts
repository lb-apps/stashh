import type { Config } from "../config.ts";
import type { HttpClient } from "../lib/http-client.ts";
import type { Logger } from "../lib/logger.ts";
import { discoverMenuUrl } from "../discovery/discoverer.ts";
import { isKnownMenuPlatform } from "../discovery/patterns.ts";
import { parseMenuContent } from "../parser/ai-parser.ts";
import { verifyMenuBelongsToPlace } from "../parser/verifier.ts";
import { scrapeMenuPage } from "../scraper/scraper.ts";
import { ImageStorage } from "../storage/images.ts";
import { type MenuRepository, type PlaceMenu } from "../storage/repository.ts";

interface PipelineDeps {
  config: Config;
  repo: MenuRepository;
  images: ImageStorage;
  httpClient: HttpClient;
  log: Logger;
}

export function createPipeline(deps: PipelineDeps): (task: PlaceMenu) => Promise<void> {
  return (task) => runPipeline(task, deps);
}

async function runPipeline(task: PlaceMenu, { config, repo, images, httpClient, log }: PipelineDeps): Promise<void> {
  const taskLog = log.child({ menuId: task.id, placeId: task.place_id });

  // 1. DISCOVER
  await repo.updateStatus(task.id, "discovering");

  // We need the place context from the original request; source_url may carry the website_url
  const discoveryCtx = {
    placeId: task.place_id,
    name: task.source_url ? "" : "unknown",
    websiteUrl: task.source_url || null,
  };

  // Look up the place to get name/city/instagram — read from the places table
  const { data: place } = await (repo as any).db
    .from("places")
    .select("name, city, website_url, instagram_username")
    .eq("id", task.place_id)
    .single();

  if (!place) {
    taskLog.warn("place not found, marking not_found");
    await repo.markNotFound(task.id);
    return;
  }

  discoveryCtx.name = place.name;
  (discoveryCtx as any).city = place.city;
  (discoveryCtx as any).instagramUsername = place.instagram_username;
  discoveryCtx.websiteUrl = place.website_url;

  const discovery = await discoverMenuUrl(discoveryCtx, config, httpClient, taskLog);

  if (discovery.candidates.length === 0) {
    taskLog.info("no menu found");
    await repo.markNotFound(task.id);
    return;
  }

  const candidate = discovery.candidates[0]!;
  const platform = isKnownMenuPlatform(candidate.url);
  const sourceType = platform?.name ?? discovery.source;
  await repo.updateMenuSource(task.id, candidate.url, sourceType, "unknown");

  // 2. SCRAPE
  await repo.updateStatus(task.id, "scraping");
  const scraped = await scrapeMenuPage(candidate.url, httpClient, taskLog);
  if (!scraped) {
    await repo.markFailed(task.id, "scrape returned no content", task.retry_count);
    return;
  }

  // 3. PARSE
  await repo.updateStatus(task.id, "parsing");
  const parsed = await parseMenuContent(scraped.content, scraped.imageUrls, config.OPENROUTER_API_KEY, taskLog);
  if (!parsed) {
    await repo.markFailed(task.id, "AI parse returned no result", task.retry_count);
    return;
  }

  // 4. VERIFY
  await repo.updateStatus(task.id, "verifying");
  const verified = await verifyMenuBelongsToPlace(
    { placeName: place.name, city: place.city, menuSourceUrl: candidate.url },
    scraped.content,
    config.OPENROUTER_API_KEY,
    taskLog,
  );
  if (!verified) {
    taskLog.info("menu failed verification — does not belong to this place");
    await repo.markFailed(task.id, "menu verification failed: does not belong to place", task.retry_count);
    return;
  }

  // 5. STORE
  for (const menu of parsed.menus) {
    await repo.updateMenuSource(task.id, candidate.url, sourceType, menu.menu_type);

    const savedCategories = await repo.saveCategories(
      task.id,
      menu.categories.map((cat, idx) => ({
        name: cat.name,
        name_en: cat.name_en ?? null,
        description: cat.description ?? null,
        description_en: cat.description_en ?? null,
        image_url: null,
        sort_order: idx,
      })),
    );

    for (let catIdx = 0; catIdx < savedCategories.length; catIdx++) {
      const savedCat = savedCategories[catIdx]!;
      const parsedCat = menu.categories[catIdx]!;

      const itemRows = await Promise.all(
        parsedCat.items.map(async (item, itemIdx) => {
          let storedImageUrl: string | null = null;
          const originalImageUrl = item.image_url ?? null;

          if (originalImageUrl) {
            storedImageUrl = await images.downloadAndStore(originalImageUrl, task.place_id, `${savedCat.id}-${itemIdx}`);
          }

          return {
            name: item.name,
            name_en: item.name_en ?? null,
            description: item.description ?? null,
            description_en: item.description_en ?? null,
            price: item.price ?? null,
            currency: item.currency ?? "TRY",
            image_url: storedImageUrl,
            original_image_url: originalImageUrl,
            is_available: item.is_available ?? true,
            sort_order: itemIdx,
            tags: item.tags ?? [],
            portion_info: item.portion_info ?? null,
          };
        }),
      );

      await repo.saveItems(savedCat.id, itemRows);
    }
  }

  await repo.updateStatus(task.id, "done", {
    language: parsed.menus[0]?.language ?? "tr",
  });
  await repo.schedulNextScrape(task.id);
  taskLog.info({ categories: parsed.menus.reduce((s, m) => s + m.categories.length, 0) }, "menu discovery complete");
}
