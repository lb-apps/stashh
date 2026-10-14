import type { Logger } from "../../lib/logger.js";

interface StepRecord {
  step: string;
  duration: number;
  [key: string]: unknown;
}

/** How one attempt went, in time: what the worker records as a recognition run. */
export interface RunTimings {
  startedAt: Date;
  totalMs: number;
  /** Duration of every step that ran, by step name, including the one that failed. */
  steps: Record<string, number>;
  failedStep: string | null;
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
  timings(): RunTimings;
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
  const startedAt = new Date();
  const steps: StepRecord[] = [];
  let lastStep: string | null = null;
  let failedStep: string | null = null;

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
        steps.push({ step: name, duration, failed: true });
        failedStep = name;
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

    timings(): RunTimings {
      return {
        startedAt,
        totalMs: Math.round(performance.now() - taskStartMs),
        steps: Object.fromEntries(steps.map((record) => [record.step, record.duration])),
        failedStep,
      };
    },
  };
}
