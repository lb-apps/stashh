import { z } from "zod";
import {
  registry,
  successEnvelope,
  commonErrorResponses,
} from "../../lib/openapi.js";

// ── Response data schemas ────────────────────────────────────────────────────

const libraryDistrictSchema = z
  .object({
    district: z.string().describe("District name (e.g. Nişantaşı, Beyoğlu)"),
    city: z.string().nullable().describe("City the district belongs to. null if not available."),
    place_count: z.number().int().describe("Number of your saved places in this district"),
  })
  .openapi("LibraryDistrict");

const libraryCategorySchema = z
  .object({
    category: z.string().describe("Category label (e.g. Cafe, Restaurant)"),
    place_count: z.number().int().describe("Number of your saved places in this category"),
  })
  .openapi("LibraryCategory");

const libraryListSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    emoji: z.string().nullable().describe("Emoji displayed on the list card. null if not set."),
    place_count: z.number().int().describe("Number of places in this list"),
  })
  .openapi("LibraryList");

const librarySummaryDataSchema = z
  .object({
    districts: z
      .array(libraryDistrictSchema)
      .describe("Your saved places grouped by district, ordered by place count descending"),
    categories: z
      .array(libraryCategorySchema)
      .describe("Your saved places grouped by category, ordered by place count descending"),
    lists: z
      .array(libraryListSchema)
      .describe("Your lists, ordered by most recently updated"),
    total_saved_count: z
      .number()
      .int()
      .describe("Total number of places you have saved"),
  })
  .openapi("LibrarySummaryData");

// ── Register paths ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: "/library",
  tags: ["Library"],
  summary: "Get Library",
  description: `Returns all the aggregated data needed to render the Library page in a single request.

The response contains four collections:
- **districts** — your saved places grouped by neighbourhood, ordered by how many places you have there
- **categories** — your saved places grouped by place type (cafe, restaurant, …), ordered by count
- **lists** — your custom lists, each with an optional emoji and a place count
- **total_saved_count** — the total number of saved places (used for the "All Places" header)

To display the **All Places** section with infinite scroll, call \`GET /places\` separately with the desired \`sort\`, \`district\`, and \`category\` filters — that endpoint is independently paginated.`,
  responses: {
    200: {
      description: "Library summary",
      content: { "application/json": { schema: successEnvelope(librarySummaryDataSchema, "LibrarySummary") } },
    },
    ...commonErrorResponses,
  },
});
