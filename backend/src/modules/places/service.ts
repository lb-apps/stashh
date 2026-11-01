import { createSupabaseServiceClient } from "../../db/supabaseClient.js";
import { config } from "../../config.js";
import { uploadPlaceThumbnail } from "../../lib/thumbnailUploader.js";
import type { Logger } from "../../lib/logger.js";
import type { IGooglePlacesClient } from "../../services/google/google-places-client.js";
import type { IGooglePhotoMediaClient } from "../../services/google/google-photo-media-client.js";
import type { Json } from "../../types/database.js";
import { AppHttpError } from "../../errors/appHttpError.js";
import type { RecognitionRepository } from "../recognitions/repository.js";
import type { RecognitionResultPlace } from "../recognitions/service.js";
import { categoryGroup, recognitionItemToPlacesInsert, mapGooglePlaceV1ToPlacesInsert, type CategoryGroup } from "./mapper.js";
import { backfillPlacesInsertFromApi } from "./mergePlacesInsert.js";
import type { PlaceInsert, PlacesRepository, PlaceRow, SavedPlaceRecord } from "./repository.js";
import type { AddPlacesBody, NearbyPlacesQuery, PatchSavedPlaceBody, PlacesListQuery } from "./types.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../lib/pagination.js";
import type { ApiPaginationMeta } from "../../http/types.js";

/** The post a saved place was found in. */
export interface SavedPlaceSourceDto {
  /** The post's link; null for a post shared in a DM, which has none. */
  url: string | null;
  type: "reel" | "post" | "story" | "tiktok" | null;
  /** The post's cover, copied to storage; null for a story or when it could not be copied. */
  thumbnail_url: string | null;
  /** The post's author, without @; null when the source does not name one. */
  author_username: string | null;
}

/**
 * Flat-merged DTO: canonical place fields + user-specific saved metadata.
 * `id` is always `places.id` (the canonical identifier). Internal `saved_places.id` never leaks.
 */
export interface SavedPlaceDto {
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
  /** What clients draw the place as; derived from `category` and `types`. */
  category_group: CategoryGroup;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  thumbnail_url: string | null;
  website_url: string | null;
  phone_number: string | null;
  google_maps_uri: string | null;
  business_status: string | null;
  types: Json | null;
  opening_hours: Json | null;
  /** Offset of the place's local time from UTC; `opening_hours` periods are in local time. */
  utc_offset_minutes: number | null;
  instagram_username: string | null;
  recommendations: Json;
  notes: string | null;
  saved_at: string;
  /** Ids of the owner's lists that hold this place. */
  list_ids: string[];
  /** When the owner last marked it visited; null when not visited. */
  visited_at: string | null;
  /** The recognition it was saved from; null when saved another way or before sources were kept. */
  source: SavedPlaceSourceDto | null;
  /** Distance in metres from the requested coordinate. Only present for nearby queries. */
  distance_m?: number;
}

const SOURCE_TYPES = new Set(["reel", "post", "story", "tiktok"]);

function toSourceDto(source: SavedPlaceRecord["source"]): SavedPlaceSourceDto | null {
  if (!source) return null;
  const type = source.result?.source_type ?? null;
  return {
    // Shared media is keyed `instagram-media:<id>`, not a link.
    url: /^https?:\/\//.test(source.source_url) ? source.source_url : null,
    type: type && SOURCE_TYPES.has(type) ? (type as SavedPlaceSourceDto["type"]) : null,
    thumbnail_url: source.result?.source_thumbnail_url ?? null,
    author_username: source.result?.author_username ?? null,
  };
}

export function toSavedPlaceDto({ place, saved_place: saved, list_ids, visits, source }: SavedPlaceRecord): SavedPlaceDto {
  return {
    id: place.id,
    google_place_id: place.google_place_id,
    name: place.name,
    address: place.address,
    short_formatted_address: place.short_formatted_address,
    city: place.city,
    district: place.district,
    country: place.country,
    location: place.location,
    category: place.category,
    category_group: categoryGroup(place.category, place.types),
    rating: place.rating,
    rating_count: place.rating_count,
    price_level: place.price_level,
    thumbnail_url: place.thumbnail_url,
    website_url: place.website_url,
    phone_number: place.phone_number,
    google_maps_uri: place.google_maps_uri,
    business_status: place.business_status,
    types: place.types,
    opening_hours: place.opening_hours,
    utc_offset_minutes: place.utc_offset_minutes,
    instagram_username: place.instagram_username,
    recommendations: place.recommendations,
    notes: saved.notes,
    saved_at: saved.created_at,
    list_ids,
    visited_at: visits.reduce<string | null>((latest, at) => (latest === null || at > latest ? at : latest), null),
    source: toSourceDto(source),
  };
}

export interface AddPlaceResultEntry {
  google_place_id: string;
  place_id: string;
  /**
   * true  → a new saved_places row was inserted for this user
   * false → user already had this place saved; no-op
   */
  created: boolean;
}

export class PlacesService {
  constructor(
    private readonly placesRepo: PlacesRepository,
    private readonly recognitionRepo: RecognitionRepository,
    private readonly googlePlacesClient: IGooglePlacesClient,
    private readonly googlePhotoMediaClient: IGooglePhotoMediaClient,
    private readonly log: Logger,
  ) {}

  async listSavedPlaces(
    ownerUserId: string,
    query: PlacesListQuery,
  ): Promise<{
    data: { items: SavedPlaceDto[]; total_count: number };
    pagination: ApiPaginationMeta;
  }> {
    const offset = decodeOffsetCursor(query.cursor);
    const filterOptions = { district: query.district, category: query.category };

    // Parallelize count + page fetch — both are independent queries (async-parallel)
    const [total, rows] = await Promise.all([
      this.placesRepo.countSavedPlaces(ownerUserId, filterOptions),
      this.placesRepo.listSavedPlacesPage(ownerUserId, offset, query.limit, {
        sort: query.sort,
        ...filterOptions,
      }),
    ]);

    const hasMore = offset + rows.length < total;
    const items = rows.map(toSavedPlaceDto);
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

  async listNearbyPlaces(
    ownerUserId: string,
    query: NearbyPlacesQuery,
  ): Promise<{
    data: { items: SavedPlaceDto[]; total_count: number };
    pagination: ApiPaginationMeta;
  }> {
    const offset = decodeOffsetCursor(query.cursor);
    const rpcParams = {
      ownerUserId,
      longitude: query.longitude,
      latitude: query.latitude,
      radiusM: query.radius_m,
      category: query.category,
    };

    // Parallelize count + page fetch (async-parallel)
    const [total, rows] = await Promise.all([
      this.placesRepo.countNearbyPlaces(rpcParams),
      this.placesRepo.listNearbyPlaces({ ...rpcParams, limit: query.limit, offset }),
    ]);

    const hasMore = offset + rows.length < total;
    // The RPC orders by distance; the full rows (lists, visits, source) come in one more read.
    const records = new Map(
      (await this.placesRepo.getSavedPlacesByIds(rows.map((r) => r.saved_place_id), ownerUserId)).map((record) => [
        record.saved_place.id,
        record,
      ]),
    );
    const items: SavedPlaceDto[] = rows.flatMap((r) => {
      const record = records.get(r.saved_place_id);
      return record ? [{ ...toSavedPlaceDto(record), distance_m: r.distance_m }] : [];
    });

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

  async getSavedPlace(ownerUserId: string, placeId: string): Promise<SavedPlaceDto> {
    const row = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!row) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    return toSavedPlaceDto(row);
  }

  async patchSavedPlace(
    ownerUserId: string,
    placeId: string,
    body: PatchSavedPlaceBody,
  ): Promise<SavedPlaceDto> {
    const existing = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!existing) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    const patch: Record<string, unknown> = {};
    if (body.notes !== undefined) patch["notes"] = body.notes;
    const updated = await this.placesRepo.updateSavedPlace(existing.saved_place.id, ownerUserId, patch);
    if (!updated) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    return this.getSavedPlace(ownerUserId, placeId);
  }

  async deleteSavedPlace(ownerUserId: string, placeId: string): Promise<{ deleted: boolean }> {
    const existing = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!existing) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    const ok = await this.placesRepo.deleteSavedPlace(existing.saved_place.id, ownerUserId);
    if (!ok) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    this.log.info({ placeId }, "saved place deleted");
    return { deleted: true };
  }

  /** Marks the saved place visited ("Been there"). Idempotent: an earlier visit is kept. */
  async markVisited(ownerUserId: string, placeId: string): Promise<SavedPlaceDto> {
    const existing = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!existing) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    await this.placesRepo.markVisited(existing.saved_place.id, ownerUserId, new Date());
    return this.getSavedPlace(ownerUserId, placeId);
  }

  /** Marks the saved place not visited, forgetting every visit. Idempotent. */
  async clearVisited(ownerUserId: string, placeId: string): Promise<SavedPlaceDto> {
    const existing = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!existing) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    await this.placesRepo.clearVisits(existing.saved_place.id, ownerUserId);
    return this.getSavedPlace(ownerUserId, placeId);
  }

  /**
   * Returns fresh photo URLs for a place the owner has saved. Each call costs Places API
   * requests, so a place outside the owner's library is a 404 like any other unknown id.
   */
  async getPlacePhotoUrls(
    ownerUserId: string,
    placeId: string,
    limit: number,
    maxWidthPx: number,
  ): Promise<{ urls: string[] }> {
    if (!(await this.placesRepo.userOwnsPlace(ownerUserId, placeId))) {
      throw new AppHttpError(404, "Place not found", "PLACE_NOT_FOUND");
    }
    const place = await this.placesRepo.getPlaceById(placeId);
    if (!place) {
      throw new AppHttpError(404, "Place not found", "PLACE_NOT_FOUND");
    }
    if (!place.google_place_id) {
      throw new AppHttpError(404, "Place not found", "PLACE_NOT_FOUND");
    }
    const names = await this.googlePlacesClient.getPlacePhotos(place.google_place_id);
    const slice = names.slice(0, limit);
    const urls: string[] = [];
    for (const name of slice) {
      const u = await this.googlePhotoMediaClient.resolvePhotoUri(name, maxWidthPx);
      if (u) urls.push(u);
    }
    this.log.debug({ placeId, photoCount: urls.length }, "photo urls resolved");
    return { urls };
  }

  async addPlaces(ownerUserId: string, body: AddPlacesBody): Promise<{ results: AddPlaceResultEntry[] }> {
    const ids = [...new Set(body.place_ids)];
    this.log.info({ source: body.source, placeCount: ids.length }, "add places");

    if (body.source === "google") {
      const results = await Promise.all(ids.map((googlePlaceId) => this.resolveAndSavePlace(googlePlaceId, ownerUserId, null, null)));
      return { results };
    }

    const owned = await this.recognitionRepo.getOwnedRecognitionResult(body.recognition_result_id, ownerUserId);
    if (!owned) {
      throw new AppHttpError(403, "Result not found or access denied", "RESULT_FORBIDDEN");
    }
    const raw = owned.result.places;
    const itemsByGoogleId = new Map((Array.isArray(raw) ? (raw as unknown as RecognitionResultPlace[]) : []).map((p) => [p.google_place_id, p]));
    const items = ids.map((googlePlaceId) => {
      const item = itemsByGoogleId.get(googlePlaceId);
      if (!item) {
        throw new AppHttpError(400, `Place ${googlePlaceId} is not in this recognition result`, "PLACE_NOT_IN_RESULT");
      }
      return item;
    });

    return { results: await this.saveRecognitionPlaces(ownerUserId, items, owned.taskId) };
  }

  /**
   * Saves places a recognition found to the owner's library, each linked to the task as its
   * source. Idempotent: a place already saved keeps its notes and original source. Used by
   * `POST /places` and by the worker for channel recognitions, which save automatically.
   */
  async saveRecognitionPlaces(
    ownerUserId: string,
    items: RecognitionResultPlace[],
    sourceTaskId: string,
  ): Promise<AddPlaceResultEntry[]> {
    const unique = [...new Map(items.map((item) => [item.google_place_id, item])).values()];
    return Promise.all(unique.map((item) => this.resolveAndSavePlace(item.google_place_id, ownerUserId, item, sourceTaskId)));
  }

  /** Validates that the user has saved the place identified by canonical places.id. */
  async assertSavedPlaceOwnership(placeId: string, ownerUserId: string): Promise<void> {
    const row = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!row) {
      throw new AppHttpError(400, "Place not saved or access denied", "INVALID_SAVED_PLACE");
    }
  }

  /**
   * Resolves a canonical places.id to the internal saved_places.id for the given owner.
   * Used by lists service when inserting into list_places.
   */
  async resolveSavedPlaceId(placeId: string, ownerUserId: string): Promise<string> {
    const row = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!row) {
      throw new AppHttpError(400, "Place not saved or access denied", "INVALID_SAVED_PLACE");
    }
    return row.saved_place.id;
  }

  private async resolveAndSavePlace(
    googlePlaceId: string,
    ownerUserId: string,
    fromRecognition: RecognitionResultPlace | null,
    sourceTaskId: string | null,
  ): Promise<AddPlaceResultEntry> {
    const existingCanonical = await this.placesRepo.getPlaceByGooglePlaceId(googlePlaceId);
    let placeRow: PlaceRow;
    let place_source: string;

    if (existingCanonical) {
      placeRow = await this.enrichExistingPlace(existingCanonical, googlePlaceId);
      place_source = "existing";
      this.log.info({ googlePlaceId, placeId: placeRow.id }, "places: reused existing canonical place");
    } else if (!fromRecognition) {
      placeRow = await this.createPlaceFromGoogle(googlePlaceId);
      place_source = "google";
      this.log.info({ googlePlaceId, placeId: placeRow.id }, "places: created new place from Google API");
    } else {
      placeRow = await this.createPlaceFromRecognition(googlePlaceId, fromRecognition);
      place_source = "recognition";
      this.log.info({ googlePlaceId, placeId: placeRow.id }, "places: created new place from recognition result");
    }

    const { created } = await this.placesRepo.tryInsertSavedPlace({
      owner_user_id: ownerUserId,
      place_id: placeRow.id,
      source_recognition_task_id: sourceTaskId,
    });

    this.log.info(
      { googlePlaceId, placeId: placeRow.id, place_source, saved_created: created },
      created ? "places: saved_places row inserted" : "places: saved_places row already existed",
    );

    return {
      google_place_id: googlePlaceId,
      place_id: placeRow.id,
      created,
    };
  }

  private async enrichExistingPlace(existing: PlaceRow, googlePlaceId: string): Promise<PlaceRow> {
    const needsEnrichment =
      existing.city === null ||
      existing.district === null ||
      existing.country === null ||
      existing.location === null ||
      existing.utc_offset_minutes === null;

    if (!needsEnrichment) return existing;

    const apiDetails = await this.googlePlacesClient.getPlaceDetails(googlePlaceId);
    if (!apiDetails?.id) return existing;

    const apiInsert = mapGooglePlaceV1ToPlacesInsert(apiDetails);
    const patch: Partial<PlaceInsert> = {};
    if (existing.city === null && apiInsert.city) patch.city = apiInsert.city;
    if (existing.district === null && apiInsert.district) patch.district = apiInsert.district;
    if (existing.country === null && apiInsert.country) patch.country = apiInsert.country;
    if (existing.location === null && apiInsert.location) patch.location = apiInsert.location;
    if (existing.utc_offset_minutes === null && apiInsert.utc_offset_minutes != null) {
      patch.utc_offset_minutes = apiInsert.utc_offset_minutes;
    }

    if (Object.keys(patch).length === 0) return existing;

    await this.placesRepo.updatePlace(existing.id, patch);
    this.log.debug({ googlePlaceId, patchKeys: Object.keys(patch) }, "enriched place");
    return { ...existing, ...patch };
  }

  private async createPlaceFromGoogle(googlePlaceId: string): Promise<PlaceRow> {
    const details = await this.googlePlacesClient.getPlaceDetails(googlePlaceId);
    if (!details?.id) {
      throw new AppHttpError(400, `Could not resolve place ${googlePlaceId}`, "PLACE_RESOLVE_FAILED");
    }
    const insert = mapGooglePlaceV1ToPlacesInsert(details);

    const placeRow = await this.placesRepo.upsertPlace({
      ...insert,
      thumbnail_url: insert.thumbnail_url ?? null,
    });

    const photos = await this.googlePlacesClient.getPlacePhotos(googlePlaceId);
    const photoName = photos[0] ?? null;
    if (photoName) {
      this.uploadThumbnailAsync(placeRow.id, googlePlaceId, photoName);
    }
    return placeRow;
  }

  private async createPlaceFromRecognition(
    googlePlaceId: string,
    item: RecognitionResultPlace,
  ): Promise<PlaceRow> {
    const partial = recognitionItemToPlacesInsert(item);
    const apiDetails = await this.googlePlacesClient.getPlaceDetails(googlePlaceId);

    let insert: PlaceInsert;
    if (!apiDetails?.id) {
      insert = partial;
    } else {
      insert = backfillPlacesInsertFromApi(partial, mapGooglePlaceV1ToPlacesInsert(apiDetails));
    }

    return this.placesRepo.upsertPlace({
      ...insert,
      thumbnail_url: insert.thumbnail_url ?? null,
    });
  }

  /** Fire-and-forget thumbnail upload — does not block the response. */
  private uploadThumbnailAsync(placeId: string, googlePlaceId: string, photoName: string): void {
    const supabase = createSupabaseServiceClient();
    uploadPlaceThumbnail(googlePlaceId, photoName, config.PLACE_THUMBNAILS_BUCKET, supabase, this.googlePhotoMediaClient)
      .then((url) => {
        if (url) {
          return this.placesRepo.updatePlace(placeId, { thumbnail_url: url });
        }
      })
      .catch((err) => {
        this.log.warn({ googlePlaceId, err }, "async thumbnail upload failed");
      });
  }
}
