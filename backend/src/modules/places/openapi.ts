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

const savedPlaceSchema = z
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
    rating_count: z.number().nullable(),
    price_level: z.number().nullable(),
    thumbnail_url: z.string().nullable(),
    website_url: z.string().nullable(),
    phone_number: z.string().nullable(),
    google_maps_uri: z.string().nullable(),
    business_status: z.string().nullable(),
    types: z.unknown().nullable(),
    opening_hours: z.unknown().nullable(),
    instagram_username: z.string().nullable(),
    recommendations: z.unknown(),
    notes: z.string().nullable(),
    saved_at: z.string().datetime(),
  })
  .openapi("SavedPlace");

const savedPlaceListDataSchema = z
  .object({
    items: z.array(savedPlaceSchema),
    total_count: z.number().int(),
  })
  .openapi("SavedPlaceListData");

const addPlaceResultEntrySchema = z
  .object({
    google_place_id: z.string(),
    place_id: z.string().uuid(),
    created: z.boolean().describe("true if a new entry was created in your saved places; false if the place was already saved"),
  })
  .openapi("AddPlaceResultEntry");

const addPlacesResultSchema = z
  .object({ results: z.array(addPlaceResultEntrySchema) })
  .openapi("AddPlacesResult");

const placePhotosDataSchema = z
  .object({ urls: z.array(z.string().url()) })
  .openapi("PlacePhotosData");

// ── Path params ──────────────────────────────────────────────────────────────

const placeIdParamsSchema = z.object({
  placeId: z.string().uuid(),
});

// ── Register paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/places",
  tags: ["Places"],
  summary: "List places",
  description: `${PAGINATION_OPERATION_DESCRIPTION} Returns all places the authenticated user has saved. Each item is a flat object combining place details (name, address, rating, photos, etc.) with your personal metadata (notes, saved date).`,
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
  description: `Save one or more places to the authenticated user's collection. The request body is a **discriminated union** on \`source\`.

### \`source: "google"\`
Provide a list of Google Place IDs to save directly. Full place details (name, address, rating, photos…) are fetched automatically — the client does not need to supply them.

### \`source: "recognition"\`
Provide a \`recognition_result_id\` and the subset of Google Place IDs from that result that the user wants to save. Place details are taken from the recognition result already on the server, so no extra lookup is required from the client.

**Both variants are idempotent**: saving a place you already have returns the same \`place_id\` with \`created: false\`. The \`place_id\` in the response is the canonical identifier you use for all subsequent operations (\`GET /places/{placeId}\`, \`PATCH\`, \`DELETE\`, photos, list membership).`,
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
  description: "Returns a list of photo URLs for any place. No ownership required — any authenticated user can fetch photos for any place ID. Ideal for lazy-loading a photo gallery after the main place details have been displayed.",
  request: {
    params: placeIdParamsSchema.openapi("PlaceIdPhotosParams"),
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
  path: "/places/{placeId}",
  tags: ["Places"],
  summary: "Get place",
  description: "Returns a single saved place with full details and your personal metadata. Use the `id` returned by `POST /places` or `GET /places`.",
  request: {
    params: placeIdParamsSchema.openapi("PlaceIdParams"),
  },
  responses: {
    200: {
      description: "Saved place details",
      content: { "application/json": { schema: successEnvelope(savedPlaceSchema, "SavedPlace") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "patch",
  path: "/places/{placeId}",
  tags: ["Places"],
  summary: "Update place",
  description: "Update personal notes on a saved place. All fields are optional — only provided fields are updated.",
  request: {
    params: placeIdParamsSchema,
    body: {
      content: { "application/json": { schema: patchSavedPlaceBodySchema.openapi("PatchSavedPlaceBody") } },
    },
  },
  responses: {
    200: {
      description: "Updated saved place",
      content: { "application/json": { schema: successEnvelope(savedPlaceSchema, "PatchSavedPlace") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/places/{placeId}",
  tags: ["Places"],
  summary: "Delete place",
  description: "Removes this place from your saved places. It is also automatically removed from any lists it was added to.",
  request: {
    params: placeIdParamsSchema,
  },
  responses: {
    204: { description: "Place deleted" },
    ...commonErrorResponses,
  },
});
