import { z } from "zod";

/**
 * Environment contract for the Instagram channel. Parsed once at boot; the process
 * refuses to start on a missing or malformed value rather than failing on first use.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3002),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  /** Secret Meta signs webhook deliveries with (`X-Hub-Signature-256`). */
  INSTAGRAM_APP_SECRET: z.string().min(1),
  /** Shared string echoed back during the webhook subscription handshake. */
  WEBHOOK_VERIFY_TOKEN: z.string().min(16),
  /** The Instagram professional account this service answers for (the webhook entry id). */
  INSTAGRAM_ACCOUNT_ID: z.string().regex(/^\d+$/),
  /**
   * Seeds the token store on first run only; after that the service refreshes the
   * token itself in `instagram_accounts`. Safe to remove once seeded.
   */
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v26.0"),

  /** Stashh backend internal API (`/internal/v1`). */
  STASHH_API_URL: z.url(),
  /** One of the backend's `INTERNAL_API_TOKENS`. */
  STASHH_API_TOKEN: z.string().min(32),

  /** Supabase project holding the channel's own tables (`instagram_messages`, `instagram_accounts`). */
  SUPABASE_URL: z.url(),
  /** Server-only `sb_secret_...` key; the channel's tables are service-role only. */
  SUPABASE_SECRET_KEY: z.string().min(1),

  /** Messages processed at once by this instance. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),

  /**
   * Development only: when set, every verified webhook body is written here verbatim
   * so real payloads can be turned into test fixtures. Refused in production.
   */
  WEBHOOK_CAPTURE_DIR: z.string().min(1).optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.WEBHOOK_CAPTURE_DIR) {
    throw new Error("WEBHOOK_CAPTURE_DIR must not be set in production");
  }
  return parsed.data;
}
