import type { SupabaseClient } from "./supabase.ts";
import type { DiscoverRequest } from "../http/routes.ts";

export type MenuStatus = "queued" | "discovering" | "scraping" | "parsing" | "verifying" | "done" | "failed" | "not_found";

export interface PlaceMenu {
  id: string;
  place_id: string;
  source_url: string;
  source_type: string;
  menu_type: string;
  language: string;
  status: MenuStatus;
  error_message: string | null;
  retry_count: number;
  discovered_at: string | null;
  scraped_at: string | null;
  parsed_at: string | null;
  verified_at: string | null;
  next_scrape_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuCategory {
  id: string;
  menu_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  description_en: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  original_image_url: string | null;
  is_available: boolean;
  sort_order: number;
  tags: string[];
  portion_info: string | null;
}

export interface PlaceMenuSummary {
  id: string;
  status: MenuStatus;
  menu_type: string;
  language: string;
  source_url: string;
  source_type: string;
  error_message: string | null;
  categories_count: number;
  items_count: number;
  created_at: string;
  updated_at: string;
}

const MAX_RETRIES = 3;

export class MenuRepository {
  readonly db: SupabaseClient;
  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async findPendingByPlaceId(placeId: string): Promise<PlaceMenu | null> {
    const { data } = await this.db
      .from("place_menus")
      .select("*")
      .eq("place_id", placeId)
      .not("status", "in", '("done","not_found","failed")')
      .limit(1)
      .single();
    return data as PlaceMenu | null;
  }

  async createDiscoveryTask(req: DiscoverRequest): Promise<PlaceMenu> {
    const { data, error } = await this.db
      .from("place_menus")
      .insert({
        place_id: req.place_id,
        source_url: req.website_url ?? "",
        source_type: "pending",
        menu_type: "unknown",
        status: "queued",
      })
      .select()
      .single();
    if (error) throw error;
    return data as PlaceMenu;
  }

  async getById(id: string): Promise<PlaceMenu | null> {
    const { data } = await this.db.from("place_menus").select("*").eq("id", id).single();
    return data as PlaceMenu | null;
  }

  async findDoneByPlaceId(placeId: string): Promise<PlaceMenu[]> {
    const { data } = await this.db.from("place_menus").select("*").eq("place_id", placeId).eq("status", "done");
    return (data ?? []) as PlaceMenu[];
  }

  async requeueForRefresh(menuId: string): Promise<void> {
    await this.db
      .from("place_menus")
      .update({ status: "queued", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", menuId);
  }

  async claimNext(): Promise<(PlaceMenu & { request_meta?: DiscoverRequest }) | null> {
    const { data, error } = await this.db.rpc("claim_menu_task");
    if (error || !data || !(data as Record<string, unknown>).id) return null;
    return data as PlaceMenu;
  }

  async updateStatus(menuId: string, status: MenuStatus, extra?: Record<string, unknown>): Promise<void> {
    const now = new Date().toISOString();
    const timestampField = statusTimestamp(status);
    await this.db
      .from("place_menus")
      .update({
        status,
        updated_at: now,
        ...(timestampField ? { [timestampField]: now } : {}),
        ...extra,
      })
      .eq("id", menuId);
  }

  async markFailed(menuId: string, errorMessage: string, currentRetry: number): Promise<void> {
    if (currentRetry < MAX_RETRIES) {
      await this.db
        .from("place_menus")
        .update({
          status: "queued",
          retry_count: currentRetry + 1,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", menuId);
    } else {
      await this.updateStatus(menuId, "failed", { error_message: errorMessage });
    }
  }

  async markNotFound(menuId: string): Promise<void> {
    await this.updateStatus(menuId, "not_found");
  }

  async saveCategories(menuId: string, categories: Omit<MenuCategory, "id" | "menu_id">[]): Promise<MenuCategory[]> {
    await this.db.from("menu_categories").delete().eq("menu_id", menuId);
    if (categories.length === 0) return [];
    const rows = categories.map((c) => ({ ...c, menu_id: menuId }));
    const { data, error } = await this.db.from("menu_categories").insert(rows).select();
    if (error) throw error;
    return (data ?? []) as MenuCategory[];
  }

  async saveItems(categoryId: string, items: Omit<MenuItem, "id" | "category_id">[]): Promise<void> {
    await this.db.from("menu_items").delete().eq("category_id", categoryId);
    if (items.length === 0) return;
    const rows = items.map((i) => ({ ...i, category_id: categoryId }));
    const { error } = await this.db.from("menu_items").insert(rows);
    if (error) throw error;
  }

  async updateMenuSource(menuId: string, sourceUrl: string, sourceType: string, menuType: string): Promise<void> {
    await this.db
      .from("place_menus")
      .update({ source_url: sourceUrl, source_type: sourceType, menu_type: menuType, updated_at: new Date().toISOString() })
      .eq("id", menuId);
  }

  async schedulNextScrape(menuId: string): Promise<void> {
    const nextScrape = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await this.db.from("place_menus").update({ next_scrape_at: nextScrape }).eq("id", menuId);
  }

  async findSummariesByGooglePlaceIds(googlePlaceIds: string[]): Promise<Map<string, PlaceMenuSummary[]>> {
    if (googlePlaceIds.length === 0) return new Map();

    const { data: places } = await this.db
      .from("places")
      .select("id, google_place_id")
      .in("google_place_id", googlePlaceIds);
    if (!places || places.length === 0) return new Map();

    const uuidToGoogle = new Map(places.map((p: { id: string; google_place_id: string }) => [p.id, p.google_place_id]));

    const { data: menus } = await this.db
      .from("place_menus")
      .select("id, place_id, status, menu_type, language, source_url, source_type, error_message, created_at, updated_at")
      .in("place_id", places.map((p: { id: string }) => p.id))
      .order("created_at", { ascending: false });

    const doneIds = (menus ?? []).filter((m: { status: string }) => m.status === "done").map((m: { id: string }) => m.id);

    let categoryCounts = new Map<string, number>();
    let itemCounts = new Map<string, number>();

    if (doneIds.length > 0) {
      const { data: cats } = await this.db.from("menu_categories").select("id, menu_id").in("menu_id", doneIds);
      for (const c of cats ?? []) categoryCounts.set(c.menu_id, (categoryCounts.get(c.menu_id) ?? 0) + 1);

      const catIds = (cats ?? []).map((c: { id: string }) => c.id);
      if (catIds.length > 0) {
        const { data: items } = await this.db.from("menu_items").select("category_id").in("category_id", catIds);
        const catToMenu = new Map((cats ?? []).map((c: { id: string; menu_id: string }) => [c.id, c.menu_id]));
        for (const i of items ?? []) {
          const menuId = catToMenu.get(i.category_id);
          if (menuId) itemCounts.set(menuId, (itemCounts.get(menuId) ?? 0) + 1);
        }
      }
    }

    const result = new Map<string, PlaceMenuSummary[]>();
    for (const menu of menus ?? []) {
      const googlePlaceId = uuidToGoogle.get(menu.place_id);
      if (!googlePlaceId) continue;
      const list = result.get(googlePlaceId) ?? [];
      list.push({
        id: menu.id,
        status: menu.status as MenuStatus,
        menu_type: menu.menu_type,
        language: menu.language,
        source_url: menu.source_url,
        source_type: menu.source_type,
        error_message: menu.error_message,
        categories_count: categoryCounts.get(menu.id) ?? 0,
        items_count: itemCounts.get(menu.id) ?? 0,
        created_at: menu.created_at,
        updated_at: menu.updated_at,
      });
      result.set(googlePlaceId, list);
    }
    return result;
  }

  async getMenuDetail(menuId: string) {
    const { data } = await this.db
      .from("place_menus")
      .select("*, menu_categories(*, menu_items(*))")
      .eq("id", menuId)
      .single();
    return data;
  }

  async getMenuWithItems(placeId: string) {
    const { data: menus } = await this.db
      .from("place_menus")
      .select("*, menu_categories(*, menu_items(*))")
      .eq("place_id", placeId)
      .eq("status", "done")
      .order("menu_type");
    return menus ?? [];
  }
}

function statusTimestamp(status: MenuStatus): string | null {
  switch (status) {
    case "discovering":
      return "discovered_at";
    case "scraping":
      return "scraped_at";
    case "parsing":
      return "parsed_at";
    case "verifying":
      return "verified_at";
    default:
      return null;
  }
}
