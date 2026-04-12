import { z } from "zod";
import type { PaginationQuery } from "../../lib/pagination.js";

export { paginationQuerySchema as placesListQuerySchema } from "../../lib/pagination.js";

export type PlacesListQuery = PaginationQuery;

const placeIdsArray = z.array(z.string().min(1)).min(1).max(50);

/** POST /places — canonical writes + user_places links */
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
  personal_note: z.string().max(5000).nullable().optional(),
  recommendations: z.array(z.unknown()).optional(),
});

export type PatchSavedPlaceBody = z.infer<typeof patchSavedPlaceBodySchema>;

export const placeIdParamsSchema = z.object({
  placeId: z.string().uuid(),
});

export const savedPlaceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const placePhotosQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  max_width_px: z.coerce.number().int().min(100).max(1600).default(800),
});
