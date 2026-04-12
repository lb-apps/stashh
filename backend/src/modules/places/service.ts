import type { Json } from "../../types/database.js";
import { AppHttpError } from "../../errors/appHttpError.js";
import {
  fetchGooglePlaceDetails,
  fetchGooglePlacePhotosField,
  mapGooglePlaceV1ToPlacesInsert,
} from "../../services/googlePlaceDetails.js";
import { uploadPlaceThumbnail, resolvePhotoUri } from "../../services/place-thumbnail.js";
import type { RecognitionRepository } from "../recognitions/repository.js";
import type { RecognitionResultItem } from "../recognitions/service.js";
import { recognitionItemToPlacesInsert } from "./mapper.js";
import { backfillPlacesInsertFromApi } from "./mergePlacesInsert.js";
import type { PlaceInsert, PlacesRepository, PlaceRow } from "./repository.js";
import type { AddPlacesBody, PatchSavedPlaceBody, PlacesListQuery } from "./types.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../lib/pagination.js";
import type { ApiPaginationMeta } from "../../http/types.js";

export interface SavedPlaceListItemDto {
  user_place_id: string;
  place_id: string;
  created_at: string;
  personal_note: string | null;
  recommendations: Json;
  source_instagram_username: string | null;
  place: PlaceDto;
}

export interface PlaceDto {
  id: string;
  google_place_id: string | null;
  name: string;
  address: string | null;
  short_formatted_address: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  location: Json | null;
  category: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: number | null;
  thumbnail_url: string | null;
  website_url: string | null;
  phone_number: string | null;
  google_maps_uri: string | null;
  business_status: string | null;
  types: Json | null;
  regular_opening_hours: Json | null;
  created_at: string;
  updated_at: string;
}

function toPlaceDto(row: PlaceRow): PlaceDto {
  return {
    id: row.id,
    google_place_id: row.google_place_id,
    name: row.name,
    address: row.address,
    short_formatted_address: row.short_formatted_address,
    city: row.city,
    district: row.district,
    country: row.country,
    location: row.location,
    category: row.category,
    rating: row.rating,
    user_rating_count: row.user_rating_count,
    price_level: row.price_level,
    thumbnail_url: row.thumbnail_url,
    website_url: row.website_url,
    phone_number: row.phone_number,
    google_maps_uri: row.google_maps_uri,
    business_status: row.business_status,
    types: row.types,
    regular_opening_hours: row.regular_opening_hours,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface AddPlaceResultEntry {
  google_place_id: string;
  place_id: string;
  user_place_id: string;
  created: boolean;
}

export class PlacesService {
  constructor(
    private readonly placesRepo: PlacesRepository,
    private readonly recognitionRepo: RecognitionRepository,
  ) {}

  async listSavedPlaces(
    ownerUserId: string,
    query: PlacesListQuery,
  ): Promise<{
    data: { items: SavedPlaceListItemDto[]; total_count: number };
    pagination: ApiPaginationMeta;
  }> {
    const offset = decodeOffsetCursor(query.cursor);
    const total = await this.placesRepo.countUserPlaces(ownerUserId);
    const rows = await this.placesRepo.listUserPlacesPage(ownerUserId, offset, query.limit);
    const hasMore = offset + rows.length < total;
    const items: SavedPlaceListItemDto[] = rows.map((r) => ({
      user_place_id: r.user_place.id,
      place_id: r.place.id,
      created_at: r.user_place.created_at,
      personal_note: r.user_place.personal_note,
      recommendations: r.user_place.recommendations,
      source_instagram_username: r.user_place.source_instagram_username,
      place: toPlaceDto(r.place),
    }));
    const pagination: ApiPaginationMeta = {
      limit: query.limit,
      next_cursor: hasMore ? encodeOffsetCursor(offset + query.limit) : null,
      has_more: hasMore,
    };
    return {
      data: { items, total_count: total },
      pagination,
    };
  }

  async getSavedPlace(ownerUserId: string, userPlaceId: string): Promise<SavedPlaceListItemDto> {
    const row = await this.placesRepo.getUserPlaceForOwner(userPlaceId, ownerUserId);
    if (!row) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    return {
      user_place_id: row.user_place.id,
      place_id: row.place.id,
      created_at: row.user_place.created_at,
      personal_note: row.user_place.personal_note,
      recommendations: row.user_place.recommendations,
      source_instagram_username: row.user_place.source_instagram_username,
      place: toPlaceDto(row.place),
    };
  }

  async patchSavedPlace(
    ownerUserId: string,
    userPlaceId: string,
    body: PatchSavedPlaceBody,
  ): Promise<SavedPlaceListItemDto> {
    const patch: Record<string, unknown> = {};
    if (body.personal_note !== undefined) patch["personal_note"] = body.personal_note;
    if (body.recommendations !== undefined) patch["recommendations"] = body.recommendations as Json;
    const updated = await this.placesRepo.updateUserPlace(userPlaceId, ownerUserId, patch);
    if (!updated) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    return this.getSavedPlace(ownerUserId, userPlaceId);
  }

  async deleteSavedPlace(ownerUserId: string, userPlaceId: string): Promise<{ deleted: boolean }> {
    const ok = await this.placesRepo.deleteUserPlace(userPlaceId, ownerUserId);
    if (!ok) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    return { deleted: true };
  }

  /**
   * Returns fresh photo URLs for a canonical place the user has saved (on-demand; not persisted).
   */
  async getPlacePhotoUrls(
    ownerUserId: string,
    placeId: string,
    limit: number,
    maxWidthPx: number,
  ): Promise<{ urls: string[] }> {
    const owns = await this.placesRepo.userOwnsPlace(ownerUserId, placeId);
    if (!owns) {
      throw new AppHttpError(403, "Forbidden", "FORBIDDEN");
    }
    const place = await this.placesRepo.getPlaceById(placeId);
    if (!place?.google_place_id) {
      throw new AppHttpError(404, "Place not found", "PLACE_NOT_FOUND");
    }
    const names = await fetchGooglePlacePhotosField(place.google_place_id);
    const slice = names.slice(0, limit);
    const urls: string[] = [];
    for (const name of slice) {
      const u = await resolvePhotoUri(name, maxWidthPx);
      if (u) urls.push(u);
    }
    return { urls };
  }

  async addPlaces(ownerUserId: string, body: AddPlacesBody): Promise<{ results: AddPlaceResultEntry[] }> {
    const ids = [...new Set(body.place_ids)];
    let itemsByGoogleId: Map<string, RecognitionResultItem> | null = null;

    if (body.source === "recognition") {
      const result = await this.recognitionRepo.getRecognitionResultByIdForOwner(
        body.recognition_result_id,
        ownerUserId,
      );
      if (!result) {
        throw new AppHttpError(403, "Result not found or access denied", "RESULT_FORBIDDEN");
      }
      const raw = result.items;
      const list = Array.isArray(raw) ? (raw as unknown as RecognitionResultItem[]) : [];
      itemsByGoogleId = new Map(list.map((it) => [it.place.googlePlaceId, it]));
      for (const googlePlaceId of ids) {
        if (!itemsByGoogleId.has(googlePlaceId)) {
          throw new AppHttpError(
            400,
            `Place ${googlePlaceId} is not in this recognition result`,
            "PLACE_NOT_IN_RESULT",
          );
        }
      }
    }

    const results = await Promise.all(
      ids.map((googlePlaceId) =>
        this.resolveAndSavePlace(googlePlaceId, ownerUserId, body, itemsByGoogleId),
      ),
    );

    return { results };
  }

  /** Used by lists API to validate user_place ownership. */
  async assertUserPlaceOwnership(userPlaceId: string, ownerUserId: string): Promise<void> {
    const row = await this.placesRepo.getUserPlaceForOwner(userPlaceId, ownerUserId);
    if (!row) {
      throw new AppHttpError(400, "Invalid user place", "INVALID_USER_PLACE");
    }
  }

  private async resolveAndSavePlace(
    googlePlaceId: string,
    ownerUserId: string,
    body: AddPlacesBody,
    itemsByGoogleId: Map<string, RecognitionResultItem> | null,
  ): Promise<AddPlaceResultEntry> {
    const fromRecognition =
      body.source === "recognition" ? (itemsByGoogleId!.get(googlePlaceId) ?? null) : null;

    const existingCanonical = await this.placesRepo.getPlaceByGooglePlaceId(googlePlaceId);
    let placeRow: PlaceRow;

    if (existingCanonical) {
      placeRow = await this.enrichExistingPlace(existingCanonical, googlePlaceId);
    } else if (body.source === "google") {
      placeRow = await this.createPlaceFromGoogle(googlePlaceId);
    } else {
      placeRow = await this.createPlaceFromRecognition(googlePlaceId, fromRecognition!);
    }

    const recJson = fromRecognition
      ? (fromRecognition.recommendations as unknown as Json)
      : ([] as unknown as Json);

    const { row: userPlaceRow, created } = await this.placesRepo.tryInsertUserPlace({
      owner_user_id: ownerUserId,
      place_id: placeRow.id,
      recommendations: recJson,
      source_instagram_username: fromRecognition?.instagramUsername ?? null,
      saved_from_source_url: null,
    });

    return {
      google_place_id: googlePlaceId,
      place_id: placeRow.id,
      user_place_id: userPlaceRow.id,
      created,
    };
  }

  private async enrichExistingPlace(existing: PlaceRow, googlePlaceId: string): Promise<PlaceRow> {
    const needsEnrichment =
      existing.city === null ||
      existing.district === null ||
      existing.country === null ||
      existing.location === null;

    if (!needsEnrichment) return existing;

    const apiDetails = await fetchGooglePlaceDetails(googlePlaceId);
    if (!apiDetails?.id) return existing;

    const apiInsert = mapGooglePlaceV1ToPlacesInsert(apiDetails);
    const patch: Partial<PlaceInsert> = {};
    if (existing.city === null && apiInsert.city) patch.city = apiInsert.city;
    if (existing.district === null && apiInsert.district) patch.district = apiInsert.district;
    if (existing.country === null && apiInsert.country) patch.country = apiInsert.country;
    if (existing.location === null && apiInsert.location) patch.location = apiInsert.location;

    if (Object.keys(patch).length === 0) return existing;

    await this.placesRepo.updatePlace(existing.id, patch);
    return { ...existing, ...patch };
  }

  private async createPlaceFromGoogle(googlePlaceId: string): Promise<PlaceRow> {
    const details = await fetchGooglePlaceDetails(googlePlaceId);
    if (!details?.id) {
      throw new AppHttpError(400, `Could not resolve place ${googlePlaceId}`, "PLACE_RESOLVE_FAILED");
    }
    const insert = mapGooglePlaceV1ToPlacesInsert(details);
    const photoName = details.photos?.[0]?.name ?? null;

    const placeRow = await this.placesRepo.upsertPlace({
      ...insert,
      thumbnail_url: insert.thumbnail_url ?? null,
    });

    if (photoName) {
      this.uploadThumbnailAsync(placeRow.id, googlePlaceId, photoName);
    }
    return placeRow;
  }

  private async createPlaceFromRecognition(
    googlePlaceId: string,
    item: RecognitionResultItem,
  ): Promise<PlaceRow> {
    const partial = recognitionItemToPlacesInsert(item);
    const apiDetails = await fetchGooglePlaceDetails(googlePlaceId);

    let insert: PlaceInsert;
    if (!apiDetails?.id) {
      insert = partial;
    } else {
      insert = backfillPlacesInsertFromApi(partial, mapGooglePlaceV1ToPlacesInsert(apiDetails));
    }

    const photoName =
      item.firstPhotoName ?? apiDetails?.photos?.[0]?.name ?? null;

    const placeRow = await this.placesRepo.upsertPlace({
      ...insert,
      thumbnail_url: insert.thumbnail_url ?? null,
    });

    if (photoName) {
      this.uploadThumbnailAsync(placeRow.id, googlePlaceId, photoName);
    }
    return placeRow;
  }

  /** Fire-and-forget thumbnail upload — does not block the response. */
  private uploadThumbnailAsync(placeId: string, googlePlaceId: string, photoName: string): void {
    uploadPlaceThumbnail(googlePlaceId, photoName)
      .then((url) => {
        if (url) {
          return this.placesRepo.updatePlace(placeId, { thumbnail_url: url });
        }
      })
      .catch((err) => {
        console.error(`[thumbnail] async upload failed for ${googlePlaceId}:`, err);
      });
  }
}