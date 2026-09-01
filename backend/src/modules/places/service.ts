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
import { recognitionItemToPlacesInsert, mapGooglePlaceV1ToPlacesInsert } from "./mapper.js";
import { backfillPlacesInsertFromApi } from "./mergePlacesInsert.js";
import type { PlaceInsert, PlacesRepository, PlaceRow } from "./repository.js";
import type { AddPlacesBody, NearbyPlacesQuery, PatchSavedPlaceBody, PlacesListQuery } from "./types.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../lib/pagination.js";
import type { ApiPaginationMeta } from "../../http/types.js";
import type { NearbyPlaceRow } from "./repository.js";

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
  instagram_username: string | null;
  recommendations: Json;
  notes: string | null;
  saved_at: string;
  /** Distance in metres from the requested coordinate. Only present for nearby queries. */
  distance_m?: number;
}

/**
 * The subset of a `places` row this mapper actually reads. Nearby results come from
 * an RPC that omits PostGIS-only columns (`geo_location`), so requiring a full
 * `PlaceRow` here would reject a perfectly valid row.
 */
type SavedPlaceSource = Omit<PlaceRow, "geo_location">;

function toSavedPlaceDto(
  place: SavedPlaceSource,
  saved: { notes: string | null; created_at: string },
): SavedPlaceDto {
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
    instagram_username: place.instagram_username,
    recommendations: place.recommendations,
    notes: saved.notes,
    saved_at: saved.created_at,
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
    const items: SavedPlaceDto[] = rows.map((r) =>
      toSavedPlaceDto(r.place, r.saved_place),
    );
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
    const items: SavedPlaceDto[] = rows.map((r: NearbyPlaceRow) => ({
      ...toSavedPlaceDto(
        {
          id: r.id,
          google_place_id: r.google_place_id,
          name: r.name,
          address: r.address,
          short_formatted_address: r.short_formatted_address,
          city: r.city,
          district: r.district,
          country: r.country,
          location: r.location,
          category: r.category,
          rating: r.rating,
          rating_count: r.rating_count,
          price_level: r.price_level,
          thumbnail_url: r.thumbnail_url,
          website_url: r.website_url,
          phone_number: r.phone_number,
          google_maps_uri: r.google_maps_uri,
          business_status: r.business_status,
          types: r.types,
          opening_hours: r.opening_hours,
          instagram_username: r.instagram_username,
          recommendations: r.recommendations,
          created_at: r.saved_at,
          updated_at: r.saved_at,
        },
        { notes: r.notes, created_at: r.saved_at },
      ),
      distance_m: r.distance_m,
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

  async getSavedPlace(ownerUserId: string, placeId: string): Promise<SavedPlaceDto> {
    const row = await this.placesRepo.getSavedPlaceByCanonicalId(placeId, ownerUserId);
    if (!row) {
      throw new AppHttpError(404, "Saved place not found", "PLACE_NOT_FOUND");
    }
    return toSavedPlaceDto(row.place, row.saved_place);
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

  /**
   * Returns fresh photo URLs for any canonical place (no ownership required).
   */
  async getPlacePhotoUrls(
    placeId: string,
    limit: number,
    maxWidthPx: number,
  ): Promise<{ urls: string[] }> {
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
    let itemsByGoogleId: Map<string, RecognitionResultPlace> | null = null;

    if (body.source === "recognition") {
      const result = await this.recognitionRepo.getRecognitionResultByIdForOwner(
        body.recognition_result_id,
        ownerUserId,
      );
      if (!result) {
        throw new AppHttpError(403, "Result not found or access denied", "RESULT_FORBIDDEN");
      }
      const raw = result.places;
      const list = Array.isArray(raw) ? (raw as unknown as RecognitionResultPlace[]) : [];
      itemsByGoogleId = new Map(list.map((p) => [p.google_place_id, p]));
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
    body: AddPlacesBody,
    itemsByGoogleId: Map<string, RecognitionResultPlace> | null,
  ): Promise<AddPlaceResultEntry> {
    const fromRecognition =
      body.source === "recognition" ? (itemsByGoogleId!.get(googlePlaceId) ?? null) : null;

    const existingCanonical = await this.placesRepo.getPlaceByGooglePlaceId(googlePlaceId);
    let placeRow: PlaceRow;
    let place_source: string;

    if (existingCanonical) {
      placeRow = await this.enrichExistingPlace(existingCanonical, googlePlaceId);
      place_source = "existing";
      this.log.info({ googlePlaceId, placeId: placeRow.id }, "places: reused existing canonical place");
    } else if (body.source === "google") {
      placeRow = await this.createPlaceFromGoogle(googlePlaceId);
      place_source = "google";
      this.log.info({ googlePlaceId, placeId: placeRow.id }, "places: created new place from Google API");
    } else {
      placeRow = await this.createPlaceFromRecognition(googlePlaceId, fromRecognition!);
      place_source = "recognition";
      this.log.info({ googlePlaceId, placeId: placeRow.id }, "places: created new place from recognition result");
    }

    const { created } = await this.placesRepo.tryInsertSavedPlace({
      owner_user_id: ownerUserId,
      place_id: placeRow.id,
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
      existing.location === null;

    if (!needsEnrichment) return existing;

    const apiDetails = await this.googlePlacesClient.getPlaceDetails(googlePlaceId);
    if (!apiDetails?.id) return existing;

    const apiInsert = mapGooglePlaceV1ToPlacesInsert(apiDetails);
    const patch: Partial<PlaceInsert> = {};
    if (existing.city === null && apiInsert.city) patch.city = apiInsert.city;
    if (existing.district === null && apiInsert.district) patch.district = apiInsert.district;
    if (existing.country === null && apiInsert.country) patch.country = apiInsert.country;
    if (existing.location === null && apiInsert.location) patch.location = apiInsert.location;

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
