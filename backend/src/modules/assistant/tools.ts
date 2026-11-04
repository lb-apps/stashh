import { z } from "zod/v4";
import { AppHttpError } from "../../errors/appHttpError.js";
import type { ToolDefinition } from "../../lib/openrouter.js";
import type { Json } from "../../types/database.js";
import type { ListsService } from "../lists/service.js";
import type { PlacesRepository, SavedPlaceRecord } from "../places/repository.js";
import { toSavedPlaceDto, type PlacesService, type SavedPlaceDto } from "../places/service.js";
import type { RecognitionRepository } from "../recognitions/repository.js";
import type { SignInLinkService } from "../sign-in-links/service.js";

/**
 * The tools the DM assistant can call, each a thin wrapper over an existing service bound to
 * the owner. Results are compact: ids plus the fields the model needs to answer, never whole
 * DTOs. Schemas are zod v4 so they can be turned into JSON schema for the model; the backend's
 * HTTP layer stays on classic zod, so nothing here is passed to `.openapi()`.
 */

/** The limits Instagram puts on what the `reply` tool can ask the channel to send. */
export const REPLY_LIMITS = {
  textChars: 900,
  quickReplies: 13,
  quickReplyTitleChars: 20,
  cards: 10,
} as const;

export const QUICK_REPLY_PAYLOAD_MAX = 1000;

const uuid = z.string().uuid();

export const replySchema = z.object({
  text: z.string().min(1).max(REPLY_LIMITS.textChars).describe("What you say, in the person's language. Plain text: no markdown, no URLs."),
  quick_replies: z
    .array(
      z.object({
        title: z.string().min(1).max(REPLY_LIMITS.quickReplyTitleChars).describe("The tap target, in the person's language."),
        payload: z.string().min(1).max(QUICK_REPLY_PAYLOAD_MAX).optional().describe("Comes back to you when tapped. A short note to yourself, or ERASE_CONFIRM."),
      }),
    )
    .max(REPLY_LIMITS.quickReplies)
    .optional()
    .describe("Tap targets under your text: a confirm / cancel pair before something irreversible, a pick among several named things, and (only while the account block says suggested quick replies are on) the obvious next step. Otherwise left out."),
  cards: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("places"), place_ids: z.array(uuid).min(1).max(REPLY_LIMITS.cards) }),
      z.object({
        kind: z.literal("lists"),
        list_ids: z.array(uuid).min(1).max(REPLY_LIMITS.cards),
        button_title: z.string().min(1).max(REPLY_LIMITS.quickReplyTitleChars).describe('The button on each list card that shows its places, e.g. "Mekânları gör".'),
      }),
    ])
    .optional()
    .describe("Swipeable cards sent before your text: saved places (photo, rating, map link) or lists. Use them instead of listing names in text."),
  map_link: z.boolean().optional().describe("Attach the button that opens the person's own map and lists on the web, signed in. Only when they want to see or open their places."),
});
export type ReplyInput = z.infer<typeof replySchema>;

/** The one tool that ends a turn; the channel renders its arguments. */
export const REPLY_TOOL = "reply";

export interface ToolServices {
  lists: Pick<ListsService, "listLists" | "listPlaces" | "createList" | "updateList" | "deleteList" | "addPlace" | "removePlaceByPlaceId">;
  places: Pick<PlacesService, "getSavedPlace" | "deleteSavedPlace" | "markVisited" | "clearVisited" | "listSavedPlaces">;
  placesRepo: Pick<PlacesRepository, "searchSavedPlaces" | "getSavedPlacesByPlaceIds" | "getPlacesByGoogleIds" | "countSavedPlaces">;
  recognitions: Pick<RecognitionRepository, "listRecentRecognitionsWithPlaces">;
  signInLinks: Pick<SignInLinkService, "mint">;
}

export interface ToolContext {
  userId: string;
  services: ToolServices;
}

interface ToolSpec<Schema extends z.ZodType> {
  name: string;
  description: string;
  schema: Schema;
  execute: (ctx: ToolContext, input: z.infer<Schema>) => Promise<unknown>;
}

function tool<Schema extends z.ZodType>(spec: ToolSpec<Schema>): ToolSpec<Schema> {
  return spec;
}

/** A saved place as the model sees it in lists and search results. */
export interface PlaceBrief {
  place_id: string;
  name: string;
  district: string | null;
  city: string | null;
  category: string | null;
  rating: number | null;
  visited: boolean;
  list_ids: string[];
}

export function toPlaceBrief(place: SavedPlaceDto): PlaceBrief {
  return {
    place_id: place.id,
    name: place.name,
    district: place.district,
    city: place.city,
    category: place.category_group,
    rating: place.rating,
    visited: place.visited_at !== null,
    list_ids: place.list_ids,
  };
}

function briefs(records: SavedPlaceRecord[]): PlaceBrief[] {
  return records.map((record) => toPlaceBrief(toSavedPlaceDto(record)));
}

function recommendationSummaries(recommendations: Json): string[] {
  if (!Array.isArray(recommendations)) return [];
  return recommendations.flatMap((item) =>
    item && typeof item === "object" && typeof (item as { summary?: unknown }).summary === "string" ? [(item as { summary: string }).summary] : [],
  );
}

/** Result places of a recognition, as stored: the Google id and name are what the model needs. */
export function recognitionPlaces(places: Json): Array<{ google_place_id: string; name: string }> {
  if (!Array.isArray(places)) return [];
  return places.flatMap((item) => {
    const place = item as { google_place_id?: unknown; name?: unknown } | null;
    return place && typeof place.google_place_id === "string" && typeof place.name === "string"
      ? [{ google_place_id: place.google_place_id, name: place.name }]
      : [];
  });
}

/** The owner's recent recognitions with their places mapped to canonical ids. */
export async function recentRecognitions(ctx: ToolContext, limit: number) {
  const rows = await ctx.services.recognitions.listRecentRecognitionsWithPlaces(ctx.userId, limit);
  const googleIds = [...new Set(rows.flatMap((row) => recognitionPlaces(row.result?.places ?? null).map((p) => p.google_place_id)))];
  const canonical = new Map((await ctx.services.placesRepo.getPlacesByGoogleIds(googleIds)).map((place) => [place.google_place_id, place.id]));
  return rows.map((row) => ({
    recognition_id: row.id,
    at: row.finished_at ?? row.created_at,
    source_type: row.result?.source_type ?? null,
    author_username: row.result?.author_username ?? null,
    places: recognitionPlaces(row.result?.places ?? null).map((place) => ({
      place_id: canonical.get(place.google_place_id) ?? null,
      name: place.name,
    })),
  }));
}

export const TOOLS = [
  tool({
    name: "get_list_places",
    description: "The places in one of the person's lists, oldest first.",
    schema: z.object({ list_id: uuid, limit: z.number().int().min(1).max(30).default(30) }),
    async execute(ctx, { list_id, limit }) {
      const page = await ctx.services.lists.listPlaces(ctx.userId, list_id, { limit, cursor: undefined });
      return { places: page.data.items.map((item) => toPlaceBrief(item.place)), has_more: page.pagination.has_more };
    },
  }),
  tool({
    name: "create_list",
    description: "Creates a list, optionally with saved places in it. Returns the new list.",
    schema: z.object({
      title: z.string().min(1).max(100),
      emoji: z.string().min(1).max(8).optional().describe("One emoji for the list, if the person named one or one is obvious."),
      place_ids: z.array(uuid).max(100).optional().describe("Saved places to put in it right away."),
    }),
    async execute(ctx, { title, emoji, place_ids }) {
      const list = await ctx.services.lists.createList(ctx.userId, {
        title,
        emoji: emoji ?? null,
        description: null,
        cover_category: null,
        place_ids: [...new Set(place_ids ?? [])],
      });
      return { list_id: list.id, title: list.title, emoji: list.emoji, place_count: list.place_count };
    },
  }),
  tool({
    name: "update_list",
    description: "Renames a list or changes its emoji.",
    schema: z.object({ list_id: uuid, title: z.string().min(1).max(100).optional(), emoji: z.string().min(1).max(8).nullable().optional() }),
    async execute(ctx, { list_id, title, emoji }) {
      const list = await ctx.services.lists.updateList(ctx.userId, list_id, {
        ...(title !== undefined ? { title } : {}),
        ...(emoji !== undefined ? { emoji } : {}),
      });
      return { list_id: list.id, title: list.title, emoji: list.emoji, place_count: list.place_count };
    },
  }),
  tool({
    name: "delete_list",
    description: "Deletes a list. The places stay saved. Only after the person confirmed with a tap in this conversation.",
    schema: z.object({ list_id: uuid }),
    async execute(ctx, { list_id }) {
      return ctx.services.lists.deleteList(ctx.userId, list_id);
    },
  }),
  tool({
    name: "add_to_list",
    description: "Puts saved places into a list. A place already there is reported, not an error.",
    schema: z.object({ list_id: uuid, place_ids: z.array(uuid).min(1).max(50) }),
    async execute(ctx, { list_id, place_ids }) {
      const added: string[] = [];
      const already: string[] = [];
      const failed: Array<{ place_id: string; error: string }> = [];
      for (const placeId of new Set(place_ids)) {
        try {
          await ctx.services.lists.addPlace(ctx.userId, list_id, { place_id: placeId });
          added.push(placeId);
        } catch (error) {
          if (error instanceof AppHttpError && error.errorCode === "USER_LIST_PLACE_DUPLICATE") already.push(placeId);
          else if (error instanceof AppHttpError && error.status < 500) failed.push({ place_id: placeId, error: error.errorCode });
          else throw error;
        }
      }
      return { added, already_in_list: already, failed };
    },
  }),
  tool({
    name: "remove_from_list",
    description: "Takes places out of a list. They stay saved.",
    schema: z.object({ list_id: uuid, place_ids: z.array(uuid).min(1).max(50) }),
    async execute(ctx, { list_id, place_ids }) {
      const removed: string[] = [];
      const notInList: string[] = [];
      for (const placeId of new Set(place_ids)) {
        try {
          await ctx.services.lists.removePlaceByPlaceId(ctx.userId, list_id, placeId);
          removed.push(placeId);
        } catch (error) {
          if (error instanceof AppHttpError && error.errorCode === "USER_LIST_PLACE_NOT_FOUND") notInList.push(placeId);
          else throw error;
        }
      }
      return { removed, not_in_list: notInList };
    },
  }),
  tool({
    name: "search_saved_places",
    description:
      "Finds places in the person's library: by words in the name, address, district or city, or filtered by district or category. Without any filter, the most recently saved.",
    schema: z.object({
      query: z.string().min(1).max(100).optional().describe("Words from the name or the area, in any language."),
      district: z.string().min(1).max(100).optional().describe("Exact district name as stored, e.g. from an earlier result."),
      category: z.string().min(1).max(60).optional().describe("A Google place type as stored, e.g. cafe, restaurant, bar."),
      limit: z.number().int().min(1).max(20).default(10),
    }),
    async execute(ctx, { query, district, category, limit }) {
      if (query) return { places: briefs(await ctx.services.placesRepo.searchSavedPlaces(ctx.userId, query, limit)) };
      const page = await ctx.services.places.listSavedPlaces(ctx.userId, {
        limit,
        cursor: undefined,
        sort: "recent",
        ...(district ? { district } : {}),
        ...(category ? { category } : {}),
      });
      return { places: page.data.items.map(toPlaceBrief), total: page.data.total_count };
    },
  }),
  tool({
    name: "get_recent_recognitions",
    description: "The posts, reels and stories the person shared most recently and the places found in each, newest first. Places are already saved.",
    schema: z.object({ limit: z.number().int().min(1).max(10).default(5) }),
    async execute(ctx, { limit }) {
      return { recognitions: await recentRecognitions(ctx, limit) };
    },
  }),
  tool({
    name: "get_place",
    description: "Everything stored about one saved place: address, phone, website, rating, the person's notes, and what the post recommended there.",
    schema: z.object({ place_id: uuid }),
    async execute(ctx, { place_id }) {
      const place = await ctx.services.places.getSavedPlace(ctx.userId, place_id);
      return {
        ...toPlaceBrief(place),
        address: place.address,
        phone: place.phone_number,
        website: place.website_url,
        google_maps_url: place.google_maps_uri,
        instagram_username: place.instagram_username,
        rating_count: place.rating_count,
        price_level: place.price_level,
        notes: place.notes,
        saved_at: place.saved_at,
        visited_at: place.visited_at,
        recommendations: recommendationSummaries(place.recommendations),
        source: place.source,
      };
    },
  }),
  tool({
    name: "mark_visited",
    description: "Marks a saved place as visited (been there), or not visited.",
    schema: z.object({ place_id: uuid, visited: z.boolean() }),
    async execute(ctx, { place_id, visited }) {
      const place = visited ? await ctx.services.places.markVisited(ctx.userId, place_id) : await ctx.services.places.clearVisited(ctx.userId, place_id);
      return { place_id: place.id, visited: place.visited_at !== null };
    },
  }),
  tool({
    name: "remove_place",
    description: "Removes a place from the person's library and every list. Only after the person confirmed with a tap in this conversation.",
    schema: z.object({ place_id: uuid }),
    async execute(ctx, { place_id }) {
      await ctx.services.places.deleteSavedPlace(ctx.userId, place_id);
      return { place_id, deleted: true };
    },
  }),
  tool({
    name: "get_map_link",
    description:
      "Confirms a personal sign-in link to the person's map on the web can be attached. Never ask for the URL: set map_link in reply and the channel adds the button.",
    schema: z.object({}),
    async execute() {
      return { available: true, how: "set map_link: true in reply" };
    },
  }),
] as const;

export type ToolName = (typeof TOOLS)[number]["name"] | typeof REPLY_TOOL;

/** The tool definitions sent to the model, `reply` last; the order is fixed so the cached prefix stays byte-identical. */
export function toolDefinitions(): ToolDefinition[] {
  return [
    ...TOOLS.map((spec) => toFunctionDefinition(spec.name, spec.description, spec.schema)),
    toFunctionDefinition(
      REPLY_TOOL,
      "Sends your answer to the person and ends your turn. Call it exactly once, last, with everything the person should see.",
      replySchema,
    ),
  ];
}

export function toFunctionDefinition(name: string, description: string, schema: z.ZodType): ToolDefinition {
  const { $schema: _dropped, ...parameters } = z.toJSONSchema(schema) as Record<string, unknown> & { $schema?: string };
  return { type: "function", function: { name, description, parameters } };
}

/** Runs one tool call for the owner. Validation and expected service errors come back as results, never as throws. */
export async function executeTool(ctx: ToolContext, name: string, args: unknown): Promise<unknown> {
  const spec = TOOLS.find((candidate) => candidate.name === name);
  if (!spec) return { error: "UNKNOWN_TOOL", message: `No tool named ${name}` };
  const parsed = spec.schema.safeParse(args ?? {});
  if (!parsed.success) return { error: "INVALID_ARGUMENTS", message: z.prettifyError(parsed.error) };
  try {
    return await (spec.execute as (ctx: ToolContext, input: unknown) => Promise<unknown>)(ctx, parsed.data);
  } catch (error) {
    if (error instanceof AppHttpError && error.status < 500) return { error: error.errorCode, message: error.message };
    throw error;
  }
}
