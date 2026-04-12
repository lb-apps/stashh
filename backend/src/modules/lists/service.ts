import { AppHttpError } from "../../errors/appHttpError.js";
import { isPostgrestError } from "../../errors/supabaseHttp.js";
import type { PlacesService } from "../places/service.js";
import { buildPaginationMeta, decodeOffsetCursor } from "../../lib/pagination.js";
import type { ApiPaginationMeta } from "../../http/types.js";
import type { ListsRepository, ListPlaceWithPlace } from "./repository.js";
import type { AddListPlaceBody, CreateListBody, ListPlacesQuery, PatchListBody } from "./types.js";

export interface ListSummaryDto {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  place_count: number;
}

export interface ListPlaceItemDto {
  list_place_id: string;
  user_place_id: string;
  created_at: string;
  place: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    address: string | null;
  };
}

export class ListsService {
  constructor(
    private readonly repo: ListsRepository,
    private readonly placesService: PlacesService,
  ) {}

  async listLists(ownerUserId: string): Promise<ListSummaryDto[]> {
    const rows = await this.repo.listListsForOwner(ownerUserId);
    const ids = rows.map((r) => r.id);
    const counts = await this.repo.countListPlacesByListIds(ownerUserId, ids);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      created_at: r.created_at,
      updated_at: r.updated_at,
      place_count: counts.get(r.id) ?? 0,
    }));
  }

  async getList(ownerUserId: string, listId: string): Promise<ListSummaryDto> {
    const row = await this.repo.getListForOwner(listId, ownerUserId);
    if (!row) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    const place_count = await this.repo.countListPlacesForList(ownerUserId, listId);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      place_count,
    };
  }

  async createList(ownerUserId: string, body: CreateListBody): Promise<ListSummaryDto> {
    const row = await this.repo.insertList({
      owner_user_id: ownerUserId,
      title: body.title,
      description: body.description ?? null,
    });
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      place_count: 0,
    };
  }

  async updateList(ownerUserId: string, listId: string, body: PatchListBody): Promise<ListSummaryDto> {
    const existing = await this.repo.getListForOwner(listId, ownerUserId);
    if (!existing) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    const updated = await this.repo.updateList(listId, ownerUserId, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
    if (!updated) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
    const place_count = await this.repo.countListPlacesForList(ownerUserId, listId);
    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      place_count,
    };
  }

  async deleteList(ownerUserId: string, listId: string): Promise<{ id: string; deleted: boolean }> {
    const deleted = await this.repo.deleteList(listId, ownerUserId);
    if (!deleted) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }
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
    const place = row.user_places?.places;
    if (!place?.id) {
      throw new AppHttpError(500, "Place data missing for list entry", "INTERNAL");
    }
    return {
      list_place_id: row.id,
      user_place_id: row.user_place_id,
      created_at: row.created_at,
      place: {
        id: place.id,
        name: place.name,
        thumbnail_url: place.thumbnail_url,
        address: place.address,
      },
    };
  }

  async addPlace(
    ownerUserId: string,
    listId: string,
    body: AddListPlaceBody,
  ): Promise<{
    list_place_id: string;
    list_id: string;
    user_place_id: string;
    created_at: string;
  }> {
    const list = await this.repo.getListForOwner(listId, ownerUserId);
    if (!list) {
      throw new AppHttpError(404, "List not found", "USER_LIST_NOT_FOUND");
    }

    await this.placesService.assertUserPlaceOwnership(body.user_place_id, ownerUserId);

    try {
      const inserted = await this.repo.insertListPlace({
        list_id: listId,
        owner_user_id: ownerUserId,
        user_place_id: body.user_place_id,
      });
      return {
        list_place_id: inserted.id,
        list_id: inserted.list_id,
        user_place_id: inserted.user_place_id,
        created_at: inserted.created_at,
      };
    } catch (e: unknown) {
      if (isPostgrestError(e) && e.code === "23505") {
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
    return { list_place_id: listPlaceId, deleted: true };
  }
}
