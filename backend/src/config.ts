import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  GOOGLE_PLACES_API_KEY: z.string().min(1, "GOOGLE_PLACES_API_KEY is required"),
  PORT: z.coerce.number().default(3000),
  TEMP_DIR: z.string().default("/tmp/discovery"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SUPABASE_URL: z.string().url("SUPABASE_URL is required"),
  /** Dashboard publishable key (`sb_publishable_...`). Preferred. */
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  /** Legacy anon JWT key — same privilege class as publishable during migration. */
  SUPABASE_ANON_KEY: z.string().optional(),
  /** Elevated key for server-only jobs (`sb_secret_...`). Bypasses RLS; never expose to clients. */
  SUPABASE_SECRET_KEY: z.string().optional(),
  DEV_TEST_EMAIL: z.string().email().optional(),
  DEV_TEST_PASSWORD: z.string().optional(),
  RECOGNITIONS_WORKER_CONCURRENCY: z.coerce.number().int().min(1).default(2),
  RECOGNITIONS_CLAIM_BATCH_SIZE: z.coerce.number().int().min(1).default(2),
  RECOGNITIONS_MAX_RETRIES: z.coerce.number().int().min(0).default(3),
  RECOGNITIONS_POLL_MIN_MS: z.coerce.number().int().min(500).default(1500),
  /** Max sleep when idle if Realtime wake is missed (fallback polling). */
  RECOGNITIONS_POLL_MAX_MS: z.coerce.number().int().min(1000).default(5000),
  RECOGNITIONS_CLAIM_TIMEOUT_MS: z.coerce.number().int().min(60000).default(900000),
  RECOGNITIONS_RECOVERY_SCAN_INTERVAL_MS: z.coerce.number().int().min(5000).default(30000),
  PLACE_THUMBNAILS_BUCKET: z.string().default("place-thumbnails"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

const supabasePublishableKey =
  trimOrUndefined(raw.SUPABASE_PUBLISHABLE_KEY) ??
  trimOrUndefined(raw.SUPABASE_ANON_KEY);

const supabaseSecretKey = trimOrUndefined(raw.SUPABASE_SECRET_KEY);

export const config = {
  ...raw,
  supabasePublishableKey,
  supabaseSecretKey,
};

export type Config = typeof config;
