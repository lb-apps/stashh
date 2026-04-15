import type { Logger } from "../../lib/logger.js";

interface StepRecord {
  step: string;
  duration: number;
  [key: string]: unknown;
}

export interface TaskLogger {
  log: Logger;
  step<T>(name: string, fn: (stepLog: Logger) => Promise<T>): Promise<T>;
  done(extra?: Record<string, unknown>): void;
  fail(error: unknown): void;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try { return JSON.stringify(error); } catch { return "unknown error"; }
}

export function createTaskLogger(
  parentLogger: Logger,
  task: { id: string; sourceUrl: string; retryCount: number; bypassCache: boolean },
): TaskLogger {
  const log = parentLogger.child({ taskId: task.id });
  const taskStartMs = performance.now();
  const steps: StepRecord[] = [];
  let lastStep: string | null = null;

  return {
    log,

    async step<T>(name: string, fn: (stepLog: Logger) => Promise<T>): Promise<T> {
      lastStep = name;
      const t0 = performance.now();
      try {
        const result = await fn(log);
        const duration = Math.round(performance.now() - t0);
        // Strip underscore-prefixed carrier keys (e.g. _result, _urls) before logging
        const raw = (typeof result === "object" && result !== null) ? result as Record<string, unknown> : {};
        const meta = Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_")));
        const record: StepRecord = { step: name, duration, ...meta };
        steps.push(record);
        log.info({ duration, ...meta }, name);
        return result;
      } catch (err) {
        const duration = Math.round(performance.now() - t0);
        log.error({ duration, err }, name);
        throw err;
      }
    },

    done(extra: Record<string, unknown> = {}) {
      const totalDuration = Math.round(performance.now() - taskStartMs);
      log.info({ totalDuration, ...extra }, "task completed");
    },

    fail(error: unknown) {
      const totalDuration = Math.round(performance.now() - taskStartMs);
      log.error(
        { totalDuration, failedAt: lastStep, error: errorMessage(error), err: error },
        "task failed",
      );
    },
  };
}
