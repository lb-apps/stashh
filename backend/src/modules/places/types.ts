import { z } from "zod";
import { paginationQuerySchema } from "../../lib/pagination.js";

export const placesListQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(["recent", "rating", "category"]).default("recent"),
  district: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

export type PlacesListQuery = z.infer<typeof placesListQuerySchema>;

const placeIdsArray = z.array(z.string().min(1)).min(1).max(50);

/** POST /places — canonical writes + saved_places links */
export const addPlacesBodySchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("google"),
    place_ids: placeIdsArray,
  }),
  z.object({
    source: z.literal("recognition"),
    recognition_result_id: z.string().uuid(),
    place_ids: placeIdsArray,
  }),
]);

export type AddPlacesBody = z.infer<typeof addPlacesBodySchema>;

export const patchSavedPlaceBodySchema = z.object({
  notes: z.string().max(5000).nullable().optional(),
});

export type PatchSavedPlaceBody = z.infer<typeof patchSavedPlaceBodySchema>;

export const placeIdParamsSchema = z.object({
  placeId: z.string().uuid(),
});

export const placePhotosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  max_width_px: z.coerce.number().int().min(100).max(1600).default(800),
});

export const nearbyPlacesQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().int().min(1).max(50_000).default(1000),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

export type NearbyPlacesQuery = z.infer<typeof nearbyPlacesQuerySchema>;
