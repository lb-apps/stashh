import { z } from "zod";
import {
  registry,
  successEnvelope,
  commonErrorResponses,
} from "../../lib/openapi.js";
import { PAGINATION_OPERATION_DESCRIPTION, paginationQuerySchema } from "../../lib/pagination.js";
import {
  createListBodySchema,
  patchListBodySchema,
  listIdParamsSchema,
  listPlaceParamsSchema,
  addListPlaceBodySchema,
} from "./types.js";

// ── Response data schemas (documentation-only) ───────────────────────────────

const listSummarySchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    place_count: z.number().int(),
  })
  .openapi("ListSummary");

const listPlaceItemSchema = z
  .object({
    list_place_id: z.string().uuid(),
    place_id: z.string().uuid(),
    created_at: z.string().datetime(),
    place: z.object({
      id: z.string().uuid(),
      name: z.string(),
      thumbnail_url: z.string().nullable(),
      address: z.string().nullable(),
    }),
  })
  .openapi("ListPlaceItem");

const listPlacesDataSchema = z
  .object({ items: z.array(listPlaceItemSchema) })
  .openapi("ListPlacesData");

const addListPlaceResultSchema = z
  .object({
    list_place_id: z.string().uuid(),
    list_id: z.string().uuid(),
    place_id: z.string().uuid(),
    created_at: z.string().datetime(),
  })
  .openapi("AddListPlaceResult");

const deleteListResultSchema = z
  .object({ id: z.string().uuid(), deleted: z.literal(true) })
  .openapi("DeleteListResult");

const removeListPlaceResultSchema = z
  .object({ list_place_id: z.string().uuid(), deleted: z.literal(true) })
  .openapi("RemoveListPlaceResult");

// ── Register paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/lists",
  tags: ["Lists"],
  summary: "List lists",
  description: "Returns all lists owned by the authenticated user. Each list includes a `place_count` for quick display without fetching the full list.",
  responses: {
    200: {
      description: "Array of list summaries",
      content: { "application/json": { schema: successEnvelope(z.array(listSummarySchema), "Lists") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "post",
  path: "/lists",
  tags: ["Lists"],
  summary: "Create list",
  description: `Creates a new list, optionally pre-populated with places in a single request.

Pass an optional \`place_ids\` array of place IDs (the \`id\` returned by \`POST /places\` or \`GET /places\`) to add places at creation time. Each place must already be in your saved places. The response \`place_count\` reflects however many places were seeded.

Omitting \`place_ids\` (or passing an empty array) creates an empty list — you can populate it later via \`POST /lists/{listId}/places\`.`,
  request: {
    body: {
      content: { "application/json": { schema: createListBodySchema.openapi("CreateListBody") } },
    },
  },
  responses: {
    201: {
      description: "List created",
      content: { "application/json": { schema: successEnvelope(listSummarySchema, "CreateList") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/lists/{listId}",
  tags: ["Lists"],
  summary: "Get list",
  description: "Returns the metadata for a single list you own. To get the places in the list, use `GET /lists/{listId}/places`.",
  request: {
    params: listIdParamsSchema.openapi("ListIdParams"),
  },
  responses: {
    200: {
      description: "List details",
      content: { "application/json": { schema: successEnvelope(listSummarySchema, "GetList") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "patch",
  path: "/lists/{listId}",
  tags: ["Lists"],
  summary: "Update list",
  description: "Update the title or description of a list. At least one field must be provided.",
  request: {
    params: listIdParamsSchema,
    body: {
      content: { "application/json": { schema: patchListBodySchema.openapi("PatchListBody") } },
    },
  },
  responses: {
    200: {
      description: "Updated list",
      content: { "application/json": { schema: successEnvelope(listSummarySchema, "PatchList") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/lists/{listId}",
  tags: ["Lists"],
  summary: "Delete list",
  description: "Permanently deletes this list. Places you had saved remain intact — only the list and its memberships are removed.",
  request: {
    params: listIdParamsSchema,
  },
  responses: {
    200: {
      description: "List deleted",
      content: { "application/json": { schema: successEnvelope(deleteListResultSchema, "DeleteList") } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "get",
  path: "/lists/{listId}/places",
  tags: ["Lists"],
  summary: "List places",
  description: `${PAGINATION_OPERATION_DESCRIPTION} Returns the places in this list, each including the essential place fields (name, address, thumbnail) needed to render a list item.`,
  request: {
    params: listIdParamsSchema,
    query: paginationQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated list of places in the list",
      content: { "application/json": { schema: successEnvelope(listPlacesDataSchema, "ListPlaces") } },
    },
    ...commonErrorResponses,
  },
  "x-pagination": "offset-cursor",
} as Parameters<typeof registry.registerPath>[0] & { "x-pagination": string });

registry.registerPath({
  method: "post",
  path: "/lists/{listId}/places",
  tags: ["Lists"],
  summary: "Add place",
  description: "Add a place to this list. The `place_id` is the place's `id` (obtained from `POST /places` or `GET /places`). The place must already be in your saved places. Adding the same place twice returns **409**.",
  request: {
    params: listIdParamsSchema,
    body: {
      content: { "application/json": { schema: addListPlaceBodySchema.openapi("AddListPlaceBody") } },
    },
  },
  responses: {
    201: {
      description: "Place added to list",
      content: { "application/json": { schema: successEnvelope(addListPlaceResultSchema, "AddListPlace") } },
    },
    409: {
      description: "Place already in list",
      content: { "application/json": { schema: z.object({ ok: z.literal(false), error: z.object({ code: z.literal("USER_LIST_PLACE_DUPLICATE"), message: z.string() }) }) } },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: "delete",
  path: "/lists/{listId}/places/{listPlaceId}",
  tags: ["Lists"],
  summary: "Remove place",
  description: "Remove a place from this list. The place remains in your saved places and any other lists — only the membership in this specific list is deleted.",
  request: {
    params: listPlaceParamsSchema.openapi("ListPlaceParams"),
  },
  responses: {
    200: {
      description: "Place removed from list",
      content: { "application/json": { schema: successEnvelope(removeListPlaceResultSchema, "RemoveListPlace") } },
    },
    ...commonErrorResponses,
  },
});
