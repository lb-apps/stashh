import type { RequestHandler } from "express";
import { z } from "zod";
import type { MenuRepository } from "../storage/repository.ts";
import type { Logger } from "../lib/logger.ts";

const discoverBody = z.object({
  place_id: z.string().uuid(),
  google_place_id: z.string().optional(),
  name: z.string(),
  city: z.string().optional(),
  website_url: z.string().url().nullable().optional(),
  instagram_username: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  types: z.unknown().optional(),
});

export type DiscoverRequest = z.infer<typeof discoverBody>;

export function createDiscoverHandler(repo: MenuRepository, log: Logger): RequestHandler {
  return async (req, res) => {
    const parsed = discoverBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: "invalid body", details: parsed.error.issues });
      return;
    }

    const existing = await repo.findPendingByPlaceId(parsed.data.place_id);
    if (existing) {
      res.status(200).json({ ok: true, data: { menu_id: existing.id, status: existing.status } });
      return;
    }

    const done = await repo.findDoneByPlaceId(parsed.data.place_id);
    if (done.length > 0) {
      res.status(200).json({ ok: true, data: { menu_id: done[0]!.id, status: "done" } });
      return;
    }

    const menu = await repo.createDiscoveryTask(parsed.data);
    log.info({ placeId: parsed.data.place_id, menuId: menu.id }, "menu discovery queued");
    res.status(202).json({ ok: true, data: { menu_id: menu.id } });
  };
}

export function createStatusHandler(repo: MenuRepository): RequestHandler {
  return async (req, res) => {
    const menuId = req.params["menuId"];
    if (!menuId || typeof menuId !== "string") {
      res.status(400).json({ ok: false, error: "missing menuId" });
      return;
    }
    const menu = await repo.getById(menuId);
    if (!menu) {
      res.status(404).json({ ok: false, error: "not found" });
      return;
    }
    res.json({ ok: true, data: menu });
  };
}

export function createOpsMenusHandler(repo: MenuRepository): RequestHandler {
  return async (req, res) => {
    const idsParam = req.query["google_place_ids"];
    if (typeof idsParam !== "string" || !idsParam) {
      res.status(400).json({ ok: false, error: "google_place_ids query param required" });
      return;
    }
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0 || ids.length > 50) {
      res.status(400).json({ ok: false, error: "1–50 google_place_ids" });
      return;
    }
    const map = await repo.findSummariesByGooglePlaceIds(ids);
    const data: Record<string, unknown[]> = {};
    for (const [key, value] of map) data[key] = value;
    res.json({ ok: true, data });
  };
}

export function createOpsMenuDetailHandler(repo: MenuRepository): RequestHandler {
  return async (req, res) => {
    const menuId = req.params["menuId"];
    if (!menuId || typeof menuId !== "string") {
      res.status(400).json({ ok: false, error: "missing menuId" });
      return;
    }
    const menu = await repo.getMenuDetail(menuId);
    if (!menu) {
      res.status(404).json({ ok: false, error: "not found" });
      return;
    }
    res.json({ ok: true, data: menu });
  };
}

export function createOpsMenuListHandler(repo: MenuRepository): RequestHandler {
  return async (_req, res) => {
    const menus = await repo.listAllMenus();
    res.json({ ok: true, data: menus });
  };
}

export function createRefreshHandler(repo: MenuRepository, log: Logger): RequestHandler {
  return async (req, res) => {
    const placeId = req.params["placeId"];
    if (!placeId || typeof placeId !== "string") {
      res.status(400).json({ ok: false, error: "missing placeId" });
      return;
    }
    const menus = await repo.findDoneByPlaceId(placeId);
    if (menus.length === 0) {
      res.status(404).json({ ok: false, error: "no menus found for this place" });
      return;
    }

    for (const menu of menus) {
      await repo.requeueForRefresh(menu.id);
    }
    log.info({ placeId, count: menus.length }, "menus requeued for refresh");
    res.status(202).json({ ok: true, data: { refreshed: menus.length } });
  };
}
