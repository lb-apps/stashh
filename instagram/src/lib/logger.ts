import { pino, type Logger } from "pino";
import type { Config } from "../config.ts";

export type { Logger };

export function createLogger(config: Pick<Config, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: config.LOG_LEVEL,
    base: { service: "instagram" },
    // Tokens and signatures must never reach the log sink.
    redact: {
      paths: ["req.headers.authorization", 'req.headers["x-hub-signature-256"]', "*.access_token"],
      censor: "[redacted]",
    },
    ...(config.NODE_ENV === "development"
      ? { transport: { target: "pino-pretty", options: { colorize: true } } }
      : {}),
  });
}
