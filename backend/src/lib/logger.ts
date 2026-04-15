import pino from "pino";
import pretty from "pino-pretty";
import { config } from "../config.js";

const isDev = process.env["NODE_ENV"] !== "production";

export const rootLogger = isDev
  ? pino({ level: config.LOG_LEVEL }, pretty({ colorize: true, sync: true }))
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
