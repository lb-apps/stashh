import { z } from "zod";

export const menuItemSchema = z.object({
  name: z.string().min(1),
  name_en: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().default("TRY"),
  image_url: z.string().nullable().optional(),
  is_available: z.boolean().default(true),
  tags: z.string().array().default([]),
  portion_info: z.string().nullable().optional(),
});

export const menuCategorySchema = z.object({
  name: z.string().min(1),
  name_en: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  items: menuItemSchema.array().min(1),
});

export const parsedMenuSchema = z.object({
  menu_type: z.enum(["food", "drinks", "desserts", "hookah", "services", "room_service", "unknown"]).catch("unknown"),
  language: z.string().transform((v) => {
    const lower = v.toLowerCase();
    if (lower.includes("tr") && lower.includes("en")) return "tr+en" as const;
    if (lower.includes("tr") || lower.includes("turk")) return "tr" as const;
    if (lower.includes("en") || lower.includes("eng")) return "en" as const;
    return "tr" as const;
  }),
  categories: menuCategorySchema.array().min(1),
});

export const aiParseResultSchema = z.object({
  menus: parsedMenuSchema.array().min(1),
});

export type ParsedMenu = z.infer<typeof parsedMenuSchema>;
export type ParsedCategory = z.infer<typeof menuCategorySchema>;
export type ParsedItem = z.infer<typeof menuItemSchema>;
export type AiParseResult = z.infer<typeof aiParseResultSchema>;
