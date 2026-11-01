import { AppHttpError } from "../../errors/appHttpError.js";
import { isPostgrestError } from "../../errors/supabaseHttp.js";
import type { Logger } from "../../lib/logger.js";
import type { CategoryGroup } from "../places/mapper.js";
import { toSavedPlaceDto, type PlacesService, type SavedPlaceDto } from "../places/service.js";
import { toSavedPlaceRecord } from "../places/repository.js";
import { buildPaginationMeta, decodeOffsetCursor } from "../../lib/pagination.js";
import type { ApiPaginationMeta } from "../../http/types.js";
import type { ListRecord, ListsRepository, ListPlaceWithPlace } from "./repository.js";
import type { AddListPlaceBody, CreateListBody, ListPlacesQuery, PatchListBody } from "./types.js";

export interface ListSummaryDto {
  id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  cover_category: CategoryGroup | null;
  created_at: string;
  updated_at: string;
  place_count: number;
}

export interface ListPlaceItemDto {
  list_place_id: string;
  place_id: string;
  created_at: string;
  place: SavedPlaceDto;
}

function toListSummaryDto(row: ListRecord, placeCount: number): ListSummaryDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    emoji: row.emoji,
    cover_category: row.cover_category as CategoryGroup | null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    place_count: placeCount,
  };
}

export class ListsService {
  constructor(
    private readonly repo: ListsRepository,
    private readonly placesService: PlacesService,
    private readonly log: Logger,
  ) {}

  async listLists(ownerUserId: string): Promise<ListSummaryDto[]> {
    const rows = await this.repo.listListsForOwner(ownerUserId);
    const ids = rows.map((r) => r.id);
    const counts = await this.repo.countListPlacesByListIds(ownerUserId, ids);
    return rows.map((r) => toListSummaryDto(r, counts.get(r.id) ?? 0));
  }

  async getList(ownerUserId: string, listId: string): Promise<ListSummaryDto> {
    const row = await this.repo.getListForOwner(listId, ownerUserId);
    if (!row) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    return toListSummaryDto(row, await this.repo.countListPlacesForList(ownerUserId, listId));
  }

  async createList(ownerUserId: string, body: CreateListBody): Promise<ListSummaryDto> {
    const row = await this.repo.insertList({
      owner_user_id: ownerUserId,
      title: body.title,
      description: body.description ?? null,
      emoji: body.emoji ?? null,
      cover_category: body.cover_category ?? null,
    });

    const placeIds = body.place_ids ?? [];

    if (placeIds.length > 0) {
      const savedPlaceIds = await Promise.all(
        placeIds.map((canonicalId) => this.placesService.resolveSavedPlaceId(canonicalId, ownerUserId)),
      );
      await this.repo.insertListPlaceBatch(
        savedPlaceIds.map((savedPlaceId) => ({
          list_id: row.id,
          owner_user_id: ownerUserId,
          saved_place_id: savedPlaceId,
        })),
      );
    }

    this.log.info({ listId: row.id, title: body.title, placeCount: placeIds.length }, "list created");
    return toListSummaryDto(row, placeIds.length);
  }

  async updateList(ownerUserId: string, listId: string, body: PatchListBody): Promise<ListSummaryDto> {
    const existing = await this.repo.getListForOwner(listId, ownerUserId);
    if (!existing) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    const updated = await this.repo.updateList(listId, ownerUserId, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.emoji !== undefined ? { emoji: body.emoji } : {}),
      ...(body.cover_category !== undefined ? { cover_category: body.cover_category } : {}),
    });
    if (!updated) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    const place_count = await this.repo.countListPlacesForList(ownerUserId, listId);
    this.log.info({ listId }, "list updated");
    return toListSummaryDto(updated, place_count);
  }

  async deleteList(ownerUserId: string, listId: string): Promise<{ id: string; deleted: boolean }> {
    const deleted = await this.repo.deleteList(listId, ownerUserId);
    if (!deleted) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    this.log.info({ listId }, "list deleted");
    return { id: listId, deleted: true };
  }

  async listPlaces(
    ownerUserId: string,
    listId: string,
    query: ListPlacesQuery,
  ): Promise<{ data: { items: ListPlaceItemDto[] }; pagination: ApiPaginationMeta }> {
    const list = await this.repo.getListForOwner(listId, ownerUserId);
    if (!list) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }

    const offset = decodeOffsetCursor(query.cursor);
    const pageSize = query.limit;
    const fetchSize = pageSize + 1;
    const rows = await this.repo.listPlacesPage(listId, ownerUserId, offset, fetchSize);
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = pageRows.map((r) => this.mapListPlaceRow(r));
    const pagination = buildPaginationMeta(pageSize, offset, rows.length);

    return { data: { items }, pagination };
  }

  private mapListPlaceRow(row: ListPlaceWithPlace): ListPlaceItemDto {
    const record = row.saved_places ? toSavedPlaceRecord(row.saved_places) : null;
    if (!record) {
      throw new AppHttpError(500, "Place data missing for list entry", "INTERNAL");
    }
    return {
      list_place_id: row.id,
      place_id: record.place.id,
      created_at: row.created_at,
      place: toSavedPlaceDto(record),
    };
  }

  async addPlace(
    ownerUserId: string,
    listId: string,
    body: AddListPlaceBody,
  ): Promise<{
    list_place_id: string;
    list_id: string;
    place_id: string;
    created_at: string;
  }> {
    const list = await this.repo.getListForOwner(listId, ownerUserId);
    if (!list) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }

    const savedPlaceId = await this.placesService.resolveSavedPlaceId(body.place_id, ownerUserId);

    try {
      const inserted = await this.repo.insertListPlace({
        list_id: listId,
        owner_user_id: ownerUserId,
        saved_place_id: savedPlaceId,
      });
      this.log.info({ listId, placeId: body.place_id }, "place added to list");
      return {
        list_place_id: inserted.id,
        list_id: inserted.list_id,
        place_id: body.place_id,
        created_at: inserted.created_at,
      };
    } catch (e: unknown) {
      if (isPostgrestError(e) && e.code === "23505") {
        this.log.debug({ listId, placeId: body.place_id }, "duplicate place in list");
        throw new AppHttpError(409, "Place already in list", "USER_LIST_PLACE_DUPLICATE");
      }
      throw e;
    }
  }

  async removePlace(
    ownerUserId: string,
    listId: string,
    listPlaceId: string,
  ): Promise<{ list_place_id: string; deleted: boolean }> {
    const list = await this.repo.getListForOwner(listId, ownerUserId);
    if (!list) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }

    const removed = await this.repo.deleteListPlace(listPlaceId, listId, ownerUserId);
    if (!removed) {
      throw new AppHttpError(404, "List place not found", "USER_LIST_PLACE_NOT_FOUND");
    }
    this.log.info({ listId, listPlaceId }, "place removed from list");
    return { list_place_id: listPlaceId, deleted: true };
  }
}
