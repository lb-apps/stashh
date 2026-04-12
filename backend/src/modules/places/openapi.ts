import { z } from "zod";
import {
  registry,
  successEnvelope,
  commonErrorResponses,
} from "../../lib/openapi.js";
import { PAGINATION_OPERATION_DESCRIPTION, paginationQuerySchema } from "../../lib/pagination.js";
import {
  addPlacesBodySchema,
  patchSavedPlaceBodySchema,
  placePhotosQuerySchema,
} from "./types.js";

// ── Response data schemas (documentation-only) ───────────────────────────────

const placeDtoSchema = z
  .object({
    id: z.string().uuid(),
    google_place_id: z.string().nullable(),
    name: z.string(),
    address: z.string().nullable(),
    short_formatted_address: z.string().nullable(),
    city: z.string().nullable(),
    district: z.string().nullable(),
    country: z.string().nullable(),
    location: z.unknown().nullable(),
    category: z.string().nullable(),
    rating: z.number().nullable(),
    user_rating_count: z.number().nullable(),
    price_level: z.number().nullable(),
    thumbnail_url: z.string().nullable(),
    website_url: z.string().nullable(),
    phone_number: z.string().nullable(),
    google_maps_uri: z.string().nullable(),
    business_status: z.string().nullable(),
    types: z.unknown().nullable(),
    regular_opening_hours: z.unknown().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("PlaceDto");

const savedPlaceListItemSchema = z
  .object({
    user_place_id: z.string().uuid(),
    place_id: z.string().uuid(),
    created_at: z.string().datetime(),
    personal_note: z.string().nullable(),
    recommendations: z.unknown(),
    source_instagram_username: z.string().nullable(),
    place: placeDtoSchema,
  })
  .openapi("SavedPlaceListItem");

const savedPlaceListDataSchema = z
  .object({
    items: z.array(savedPlaceListItemSchema),
    total_count: z.number().int(),
  })
  .openapi("SavedPlaceListData");

const addPlaceResultEntrySchema = z
  .object({
    google_place_id: z.string(),
    place_id: z.string().uuid(),
    user_place_id: z.string().uuid(),
    created: z.boolean(),
  })
  .openapi("AddPlaceResultEntry");

const addPlacesResultSchema = z
  .object({ results: z.array(addPlaceResultEntrySchema) })
  .openapi("AddPlacesResult");

const placePhotosDataSchema = z
  .object({ urls: z.array(z.string().url()) })
  .openapi("PlacePhotosData");

// ── Path params ──────────────────────────────────────────────────────────────

const userPlaceIdParamsSchema = z.object({
  userPlaceId: z.string().uuid(),
});

const canonicalPlaceIdParamsSchema = z.object({
  placeId: z.string().uuid(),
});

// ── Register paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/places",
  tags: ["Places"],
  summary: "List places",
  description: `${PAGINATION_OPERATION_DESCRIPTION} Each item joins \`user_places\` with the canonical \`places\` row.`,
  request: {
    query: paginationQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated list of saved places",
      content: { "application/json": { schema: successEnvelope(savedPlaceListDataSchema, "PlacesList") } },
    },
    ...commonErrorResponses,
  },
  "x-pagination": "offset-cursor",
} as Parameters<typeof registry.registerPath>[0] & { "x-pagination": string });

registry.registerPath({
  method: "post",
  path: "/places",
  tags: ["Places"],
  summary: "Add places",
  description:
    "Links Google Place IDs (or recognition-derived IDs) to the user. Missing canonical rows may be upserted from Places API or recognition payloads.",
  request: {
    body: {
      content: { "application/json": { schema: addPlacesBodySchema.openapi("AddPlacesBody") } },
    },
  },
  responses: {
    201: {
      description: "Places added",
      content: { "application/json": { schema: successEnvelope(addPlacesResultSchema, "AddPlaces") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/places/photos/{placeId}",
  tags: ["Places"],
  summary: "Photo URLs",
  description: "`placeId` is the canonical `places.id`. Returns URLs suitable for on-demand gallery loading.",
  request: {
    params: canonicalPlaceIdParamsSchema.openapi("CanonicalPlaceIdParams"),
    query: placePhotosQuerySchema.openapi("PlacePhotosQuery"),
  },
  responses: {
    200: {
      description: "Photo URLs",
      content: { "application/json": { schema: successEnvelope(placePhotosDataSchema, "PlacePhotos") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/places/{userPlaceId}",
  tags: ["Places"],
  summary: "Get place",
  description: "Path id is `user_places.id` (your saved copy), not the canonical place id.",
  request: {
    params: userPlaceIdParamsSchema.openapi("UserPlaceIdParams"),
  },
  responses: {
    200: {
      description: "Saved place details",
      content: { "application/json": { schema: successEnvelope(savedPlaceListItemSchema, "SavedPlace") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "patch",
  path: "/places/{userPlaceId}",
  tags: ["Places"],
  summary: "Update place",
  description: "Partial update of fields on the saved place (e.g. personal note, recommendations).",
  request: {
    params: userPlaceIdParamsSchema,
    body: {
      content: { "application/json": { schema: patchSavedPlaceBodySchema.openapi("PatchSavedPlaceBody") } },
    },
  },
  responses: {
    200: {
      description: "Updated saved place",
      content: { "application/json": { schema: successEnvelope(savedPlaceListItemSchema, "PatchSavedPlace") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/places/{userPlaceId}",
  tags: ["Places"],
  summary: "Delete place",
  description: "Deletes your `user_places` row; canonical `places` data may remain for other users.",
  request: {
    params: userPlaceIdParamsSchema,
  },
  responses: {
    204: { description: "Place deleted" },
    ...commonErrorResponses,
  },
});
