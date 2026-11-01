import { z } from "zod";
import {
  registry,
  successEnvelope,
  commonErrorResponses,
} from "../../lib/openapi.js";
import { PAGINATION_OPERATION_DESCRIPTION } from "../../lib/pagination.js";
import { CATEGORY_GROUPS } from "./mapper.js";
import {
  addPlacesBodySchema,
  nearbyPlacesQuerySchema,
  patchSavedPlaceBodySchema,
  placePhotosQuerySchema,
  placesListQuerySchema,
} from "./types.js";

// ── Response data schemas (documentation-only) ───────────────────────────────

const savedPlaceSourceSchema = z
  .object({
    url: z.string().url().nullable().describe("The post's link; null for a post shared in a DM, which has none"),
    type: z.enum(["reel", "post", "story", "tiktok"]).nullable(),
    thumbnail_url: z.string().url().nullable().describe("The post's cover; null for a story or when it could not be copied"),
    author_username: z.string().nullable().describe("The post's author, without @; null when the source does not name one"),
  })
  .openapi("SavedPlaceSource");

export const savedPlaceSchema = z
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
    category: z.string().nullable().describe("Google primary type"),
    category_group: z
      .enum(CATEGORY_GROUPS)
      .describe("What clients draw the place as (pin colour, icon, filter), derived from `category` and `types`. `default` when no group fits."),
    rating: z.number().nullable(),
    rating_count: z.number().nullable(),
    price_level: z.number().nullable(),
    thumbnail_url: z.string().nullable(),
    website_url: z.string().nullable(),
    phone_number: z.string().nullable(),
    google_maps_uri: z.string().nullable(),
    business_status: z.string().nullable(),
    types: z.unknown().nullable(),
    opening_hours: z.unknown().nullable().describe("Google `regularOpeningHours.periods`, in the place's local time"),
    utc_offset_minutes: z
      .number()
      .int()
      .nullable()
      .describe("Offset of the place's local time from UTC, for computing open now from `opening_hours`; null until the place is enriched from Google"),
    instagram_username: z.string().nullable(),
    recommendations: z.unknown(),
    notes: z.string().nullable(),
    saved_at: z.string().datetime(),
    list_ids: z.array(z.string().uuid()).describe("Your lists that hold this place"),
    visited_at: z.string().datetime().nullable().describe("When you marked it visited (\"Been there\"); null when not visited"),
    source: savedPlaceSourceSchema
      .nullable()
      .describe("The post the place was found in; null when saved from search or before sources were kept (2026-11)"),
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

const savedPlaceWithDistanceSchema = savedPlaceSchema.extend({
  distance_m: z.number().describe("Distance from the requested coordinate in metres").optional(),
}).openapi("SavedPlaceWithDistance");

const nearbyPlacesListDataSchema = z
  .object({
    items: z.array(savedPlaceWithDistanceSchema),
    total_count: z.number().int(),
  })
  .openapi("NearbyPlacesListData");

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
  description: `${PAGINATION_OPERATION_DESCRIPTION} Returns all places the authenticated user has saved. Each item is a flat object combining place details (name, address, rating, photos, etc.) with your personal metadata (notes, saved date, lists, visit, source post).

Each item carries everything a client needs to search, filter and scope the library itself — \`category_group\`, \`district\`, \`list_ids\`, \`visited_at\`, \`opening_hours\` with \`utc_offset_minutes\` — so the web app loads the library once (\`limit=100\`, following \`next_cursor\`) and derives every view from it.

### Sorting

Use the \`sort\` query parameter to control ordering:
- \`recent\` (default) — most recently saved first
- \`rating\` — highest rated first; unrated places appear last
- \`category\` — alphabetical by category, then by name

### Filtering

Pass \`district\` and/or \`category\` to narrow results to a specific neighbourhood or place type. Both filters compose with each other and with the sort order.`,
  request: {
    query: placesListQuerySchema.openapi("PlacesListQuery"),
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
  description: "Returns photo URLs for a place you have saved; any other place id is `404`. Ideal for lazy-loading a photo gallery after the main place details have been displayed. Sent with `Cache-Control: private, max-age=86400`: the links stay valid for days, so the browser keeps the answer for a day.",
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
  path: "/places/nearby",
  tags: ["Places"],
  summary: "Nearby places",
  description: `${PAGINATION_OPERATION_DESCRIPTION} Returns saved places within the specified radius of a coordinate, ordered by distance ascending. Only places already in your library are returned — use \`POST /places\` to save a place first.

The \`distance_m\` field on each item is the geodesic distance in metres from the requested coordinate, suitable for displaying "200 m away" or "1.2 km away" labels.

Radius is capped at **50 km** (50 000 m) to keep query times bounded.`,
  request: {
    query: nearbyPlacesQuerySchema.openapi("NearbyPlacesQuery"),
  },
  responses: {
    200: {
      description: "Paginated list of nearby saved places ordered by distance",
      content: { "application/json": { schema: successEnvelope(nearbyPlacesListDataSchema, "NearbyPlacesList") } },
    },
    ...commonErrorResponses,
  },
  "x-pagination": "offset-cursor",
} as Parameters<typeof registry.registerPath>[0] & { "x-pagination": string });

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

registry.registerPath({
  method: "put",
  path: "/places/{placeId}/visit",
  tags: ["Places"],
  summary: "Mark visited",
  description: "Marks a saved place visited (\"Been there\") and returns it with `visited_at` set. Idempotent: marking a place already visited keeps the earlier visit.",
  request: { params: placeIdParamsSchema },
  responses: {
    200: {
      description: "The saved place, visited",
      content: { "application/json": { schema: successEnvelope(savedPlaceSchema, "MarkPlaceVisited") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/places/{placeId}/visit",
  tags: ["Places"],
  summary: "Unmark visited",
  description: "Marks a saved place not visited, forgetting every visit, and returns it with `visited_at: null`. Idempotent.",
  request: { params: placeIdParamsSchema },
  responses: {
    200: {
      description: "The saved place, not visited",
      content: { "application/json": { schema: successEnvelope(savedPlaceSchema, "UnmarkPlaceVisited") } },
    },
    ...commonErrorResponses,
  },
});
