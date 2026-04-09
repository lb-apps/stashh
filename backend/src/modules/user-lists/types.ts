import { z } from "zod";

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
});

export const patchListBodySchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
  })
  .refine((b) => b.title !== undefined || b.description !== undefined, {
    message: "At least one of title, description is required",
  });

export const addListPlaceBodySchema = z.object({
  user_place_id: z.string().uuid(),
});

export const listPlacesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
});

export type CreateListBody = z.infer<typeof createListBodySchema>;
export type PatchListBody = z.infer<typeof patchListBodySchema>;
export type AddListPlaceBody = z.infer<typeof addListPlaceBodySchema>;
export type ListPlacesQuery = z.infer<typeof listPlacesQuerySchema>;
