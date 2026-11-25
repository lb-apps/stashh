import pino from "pino";
import type { Config } from "../config.ts";

export function createLogger(config: Pick<Config, "LOG_LEVEL" | "NODE_ENV">) {
  return pino({
    level: config.LOG_LEVEL,
    ...(config.NODE_ENV !== "production" && { transport: { target: "pino-pretty" } }),
  });
}

export type Logger = pino.Logger;
