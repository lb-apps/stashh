import pino from "pino";
import { config } from "../config.js";

const isDev = process.env["NODE_ENV"] !== "production";

// pino-pretty is a dev dependency, loaded only outside production so the production image
// (which prunes dev dependencies) never needs it; production logs are JSON lines.
export const rootLogger = isDev
  ? pino({ level: config.LOG_LEVEL }, (await import("pino-pretty")).default({ colorize: true, sync: true }))
  : pino({ level: config.LOG_LEVEL });

export interface Logger {
  fatal: pino.LogFn;
  error: pino.LogFn;
  warn: pino.LogFn;
  info: pino.LogFn;
  debug: pino.LogFn;
  trace: pino.LogFn;
  child(bindings: pino.Bindings, options?: pino.ChildLoggerOptions): Logger;
}
