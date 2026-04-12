import { z } from "zod";
import type { Database } from "../../types/database.js";

export type RecognitionTaskRow = Database["public"]["Tables"]["recognition_tasks"]["Row"];
export type RecognitionTaskInsert = Database["public"]["Tables"]["recognition_tasks"]["Insert"];
export type RecognitionTaskUpdate = Database["public"]["Tables"]["recognition_tasks"]["Update"];
export type RecognitionResultRow = Database["public"]["Tables"]["recognition_results"]["Row"];

export const createRecognitionRequestSchema = z.object({
  source_url: z
    .string()
    .url()
    .refine(
      (url) => /instagram\.com\/(reel|p|stories)\//i.test(url),
      "Must be a valid Instagram Reel, Post, or Story URL",
    ),
});

export const recognitionIdentifierSchema = z.object({
  id: z.string().uuid("Recognition id must be a UUID"),
});

/** Query for GET /recognitions/result?id= */
export const recognitionResultQuerySchema = z.object({
  id: z.string().uuid("Result id must be a UUID"),
});
