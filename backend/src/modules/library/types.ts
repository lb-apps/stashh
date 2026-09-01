import { z } from "zod";

export const librarySummaryDistrictSchema = z.object({
  district: z.string(),
  city: z.string().nullable(),
  place_count: z.number().int(),
});

export const librarySummaryCategorySchema = z.object({
  category: z.string(),
  place_count: z.number().int(),
});

export const librarySummaryListSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  emoji: z.string().nullable(),
  place_count: z.number().int(),
});

export const librarySummaryResponseSchema = z.object({
  districts: z.array(librarySummaryDistrictSchema),
  categories: z.array(librarySummaryCategorySchema),
  lists: z.array(librarySummaryListSchema),
  total_saved_count: z.number().int(),
});

export type LibrarySummaryDistrict = z.infer<typeof librarySummaryDistrictSchema>;
export type LibrarySummaryCategory = z.infer<typeof librarySummaryCategorySchema>;
export type LibrarySummaryList = z.infer<typeof librarySummaryListSchema>;
export type LibrarySummaryResponse = z.infer<typeof librarySummaryResponseSchema>;
