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
