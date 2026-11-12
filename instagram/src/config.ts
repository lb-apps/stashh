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

  /**
   * Bearer tokens for `GET /ops/stats` (the local ops dashboard), comma-separated so one
   * can rotate. Each ≥ 32 chars. Unset → the route does not exist.
   */
  OPS_API_TOKENS: z
    .string()
    .optional()
    .transform((value) => (value ?? "").split(",").map((t) => t.trim()).filter(Boolean))
    .refine((tokens) => tokens.every((t) => t.length >= 32), "Each OPS_API_TOKENS entry must be ≥ 32 chars"),

  /**
   * Opens the hooks relay's envelope (`hooks.stashh.me`); the same value as the Worker's secret.
   * Unset → the relay's probe is not answered (it routes nobody here) and an enveloped delivery
   * is refused; Meta's direct deliveries work either way.
   */
  HOOKS_RELAY_SECRET: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(32).optional()),

  /**
   * Outside production: `routed` (default, only senders the relay routed here), `live` (anyone;
   * for testing without the relay) or `off`. Ignored in production, which always writes.
   */
  META_OUTBOUND: z.string().optional(),

  /** Messages processed at once by this instance. */
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),

  /**
   * Quick replies under a finished recognition ("Listeye koy", "Haritamı aç") that hand the
   * next step to the assistant. Off by the owner's call (2026-11-04): people write what they want.
   */
  RECOGNITION_SUGGESTED_REPLIES: z.enum(["on", "off"]).default("off"),

  /**
   * Mixpanel project token for the conversation's product events (docs/analytics-plan.md):
   * "Stashh - Production" on the production host, "Stashh - Staging" anywhere else.
   * Unset or empty → no events.
   */
  MIXPANEL_TOKEN: z.preprocess((value) => (value === "" ? undefined : value), z.string().min(16).optional()),

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
