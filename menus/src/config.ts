import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3004),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  OPENROUTER_API_KEY: z.string().min(1),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  GOOGLE_CSE_ID: z.string().min(1).optional(),

  INTERNAL_API_TOKENS: z
    .string()
    .transform((value) => value.split(",").map((t) => t.trim()).filter(Boolean))
    .refine((tokens) => tokens.length > 0 && tokens.every((t) => t.length >= 32), "Each token must be ≥ 32 chars"),

  MENU_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  IMAGE_MAX_WIDTH: z.coerce.number().int().min(100).max(2000).default(800),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
