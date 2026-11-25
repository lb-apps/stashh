import type { Config } from "../config.js";
import { rootLogger } from "./logger.js";

const log = rootLogger.child({ component: "menu-client" });

export async function triggerMenuDiscovery(
  place: { id: string; google_place_id: string | null; name: string; city: string | null; website_url: string | null; instagram_username: string | null; category: string | null; types: unknown },
  config: Config,
): Promise<void> {
  if (!config.MENU_SERVICE_URL || !config.MENU_SERVICE_TOKEN) return;

  try {
    await fetch(`${config.MENU_SERVICE_URL}/internal/v1/discover`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.MENU_SERVICE_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        place_id: place.id,
        google_place_id: place.google_place_id,
        name: place.name,
        city: place.city,
        website_url: place.website_url,
        instagram_username: place.instagram_username,
        category: place.category,
        types: place.types,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    log.warn({ err, placeId: place.id }, "menu discovery trigger failed");
  }
}
