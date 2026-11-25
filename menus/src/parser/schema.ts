import { z } from "zod";

function isAllCaps(s: string, locale: string): boolean {
  return s === s.toLocaleUpperCase(locale) && s !== s.toLocaleLowerCase(locale);
}

function toTitleCase(s: string, locale: string): string {
  const lower = s.toLocaleLowerCase(locale);
  let result = "";
  let capNext = true;
  for (const ch of lower) {
    if (/[\s\-\/\(\)''""‘’“”]/.test(ch)) {
      capNext = true;
      result += ch;
    } else if (capNext) {
      result += ch.toLocaleUpperCase(locale);
      capNext = false;
    } else {
      result += ch;
    }
  }
  return result;
}

function toSentenceCase(s: string, locale: string): string {
  const lower = s.toLocaleLowerCase(locale);
  for (let i = 0; i < lower.length; i++) {
    if (/\S/.test(lower[i]!)) {
      return lower.slice(0, i) + lower[i]!.toLocaleUpperCase(locale) + lower.slice(i + 1);
    }
  }
  return lower;
}

function normalizeName(s: string, locale: string): string {
  return isAllCaps(s, locale) ? toTitleCase(s, locale) : s;
}

function normalizeOptionalName<T extends string | null | undefined>(v: T, locale: string): T {
  if (typeof v === "string") return normalizeName(v, locale) as T;
  return v;
}

function normalizeDescription<T extends string | null | undefined>(v: T, locale: string): T {
  if (typeof v === "string" && isAllCaps(v, locale)) return toSentenceCase(v, locale) as T;
  return v;
}

export const menuItemSchema = z.object({
  name: z.string().min(1).transform((s) => normalizeName(s, "tr")),
  name_en: z.string().nullable().optional().transform((v) => normalizeOptionalName(v, "en")),
  description: z.string().nullable().optional().transform((v) => normalizeDescription(v, "tr")),
  description_en: z.string().nullable().optional().transform((v) => normalizeDescription(v, "en")),
  price: z.number().nullable().optional(),
  currency: z.string().default("TRY"),
  image_url: z.string().nullable().optional(),
  is_available: z.boolean().default(true),
  tags: z.string().array().default([]),
  portion_info: z.string().nullable().optional(),
});

export const menuCategorySchema = z.object({
  name: z.string().min(1).transform((s) => normalizeName(s, "tr")),
  name_en: z.string().nullable().optional().transform((v) => normalizeOptionalName(v, "en")),
  description: z.string().nullable().optional().transform((v) => normalizeDescription(v, "tr")),
  description_en: z.string().nullable().optional().transform((v) => normalizeDescription(v, "en")),
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
