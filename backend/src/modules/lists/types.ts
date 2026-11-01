import { z } from "zod";
import type { PaginationQuery } from "../../lib/pagination.js";
import { CATEGORY_GROUPS } from "../places/mapper.js";

/** A list cover: one of the place category groups; null for the default art. */
const coverCategorySchema = z.enum(CATEGORY_GROUPS).nullable();

export const listIdParamsSchema = z.object({
  listId: z.string().uuid(),
});

export const listPlaceParamsSchema = z.object({
  listId: z.string().uuid(),
  listPlaceId: z.string().uuid(),
});

export const createListBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  emoji: z.string().emoji().max(8).nullable().optional(),
  cover_category: coverCategorySchema.optional(),
  place_ids: z.array(z.string().uuid()).max(100).optional(),
});

export const patchListBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    emoji: z.string().emoji().max(8).nullable().optional(),
    cover_category: coverCategorySchema.optional(),
  })
  .refine(
    (b) => b.title !== undefined || b.description !== undefined || b.emoji !== undefined || b.cover_category !== undefined,
    { message: "At least one of title, description, emoji, cover_category is required" },
  );

export const addListPlaceBodySchema = z.object({
  place_id: z.string().uuid(),
});

export { paginationQuerySchema as listPlacesQuerySchema } from "../../lib/pagination.js";

export type CreateListBody = z.infer<typeof createListBodySchema>;
export type PatchListBody = z.infer<typeof patchListBodySchema>;
export type AddListPlaceBody = z.infer<typeof addListPlaceBodySchema>;
export type ListPlacesQuery = PaginationQuery;
