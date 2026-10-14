import type { Logger } from "../../lib/logger.js";

interface StepRecord {
  step: string;
  duration: number;
  [key: string]: unknown;
}

export interface TaskLogger {
  log: Logger;
  /**
   * Runs one pipeline step, timing it and logging a summary. The step's value is
   * returned as-is and fully typed; `summarize` picks what goes into the log line.
   */
  step<T>(
    name: string,
    fn: (stepLog: Logger) => Promise<T>,
    summarize?: (result: T) => Record<string, unknown>,
  ): Promise<T>;
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

    async step<T>(
      name: string,
      fn: (stepLog: Logger) => Promise<T>,
      summarize?: (result: T) => Record<string, unknown>,
    ): Promise<T> {
      lastStep = name;
      const t0 = performance.now();
      try {
        const result = await fn(log);
        const duration = Math.round(performance.now() - t0);
        const meta = summarize?.(result) ?? {};
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
