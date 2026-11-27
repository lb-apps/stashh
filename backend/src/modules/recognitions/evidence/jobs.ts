import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelUsage } from "../../../lib/openrouter.js";
import type { Logger } from "../../../lib/logger.js";
import type { Database } from "../../../types/database.js";

/**
 * The background queue behind recognitions (`evidence_jobs`): work that waits for nobody, run
 * after the reply has gone. A job is claimed under a lease, run once, and then done, queued again
 * after a back-off, or failed for good after its last attempt. Every job is idempotent, so a job a
 * dead worker leaves behind can simply run again.
 */

export type EvidenceJobKind = "attribute" | "digest";

export interface EvidenceJob {
  id: number;
  kind: string;
  subject_id: string;
  attempts: number;
}

/** What a job's model calls were, for the job's cost columns. */
export interface JobOutcome {
  model: string | null;
  usage: ModelUsage | null;
}

export type JobHandler = (job: EvidenceJob, log: Logger) => Promise<JobOutcome>;

export interface EvidenceJobsLoop {
  /** Claim now instead of at the next poll: called after this process queued a job. */
  wake(): void;
  /** Stops claiming and waits for running jobs. */
  stop(): Promise<void>;
}

const MAX_ATTEMPTS = 3;
const LEASE_SECONDS = 300;

/** 30 s, 90 s, then 270 s; never more than ten minutes. */
export function retryDelaySeconds(attempts: number): number {
  return Math.min(600, 30 * 3 ** Math.max(0, attempts - 1));
}

export function startEvidenceJobs(options: {
  db: SupabaseClient<Database>;
  log: Logger;
  concurrency: number;
  pollMs: number;
  handlers: Partial<Record<EvidenceJobKind, JobHandler>>;
}): EvidenceJobsLoop {
  const { db, log, concurrency, pollMs, handlers } = options;
  let running = true;
  let pendingWake = false;
  let wakeResolver: (() => void) | null = null;
  const inFlight = new Set<Promise<void>>();

  const wake = () => {
    pendingWake = true;
    wakeResolver?.();
    wakeResolver = null;
  };

  const sleep = (ms: number) => {
    if (pendingWake) {
      pendingWake = false;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        wakeResolver = null;
        resolve();
      }, ms);
      wakeResolver = () => {
        clearTimeout(timeout);
        pendingWake = false;
        resolve();
      };
    });
  };

  async function finish(job: EvidenceJob, outcome: "done" | "retry" | "failed", jobLog: Logger, result: JobOutcome | null, error?: unknown) {
    const { error: finishError } = await db.rpc("finish_evidence_job", {
      p_id: job.id,
      p_outcome: outcome,
      p_error: error === undefined ? null : (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      p_retry_seconds: retryDelaySeconds(job.attempts),
      p_model: result?.model ?? null,
      p_prompt_tokens: result?.usage?.prompt_tokens ?? null,
      p_completion_tokens: result?.usage?.completion_tokens ?? null,
      p_cost_usd: result?.usage?.cost_usd ?? null,
    });
    // The lease brings the job back if this write is lost.
    if (finishError) jobLog.error({ err: finishError, outcome }, "evidence job not finished");
  }

  async function run(job: EvidenceJob) {
    const jobLog = log.child({ job: job.id, kind: job.kind, subject: job.subject_id, attempt: job.attempts });
    const handler = handlers[job.kind as EvidenceJobKind];
    if (!handler) {
      await finish(job, "failed", jobLog, null, new Error(`No handler for evidence job kind ${job.kind}`));
      return;
    }
    const startedAt = Date.now();
    try {
      const result = await handler(job, jobLog);
      await finish(job, "done", jobLog, result);
      jobLog.info({ duration: Date.now() - startedAt, model: result.model, costUsd: result.usage?.cost_usd ?? null }, "evidence job done");
    } catch (error) {
      const outcome = job.attempts >= MAX_ATTEMPTS ? "failed" : "retry";
      jobLog.warn({ err: error, outcome, duration: Date.now() - startedAt }, "evidence job failed");
      await finish(job, outcome, jobLog, null, error);
    }
  }

  async function loop() {
    log.info({ concurrency }, "evidence jobs started");
    while (running) {
      try {
        const capacity = concurrency - inFlight.size;
        if (capacity <= 0) {
          await sleep(pollMs);
          continue;
        }
        const { data, error } = await db.rpc("claim_evidence_jobs", { p_limit: capacity, p_lease_seconds: LEASE_SECONDS });
        if (error) throw error;
        const jobs = (data ?? []) as EvidenceJob[];
        if (jobs.length === 0) {
          await sleep(pollMs);
          continue;
        }
        for (const job of jobs) {
          const task = run(job).finally(() => {
            inFlight.delete(task);
            wake();
          });
          inFlight.add(task);
        }
      } catch (error) {
        log.error({ err: error }, "evidence jobs loop error");
        await sleep(pollMs);
      }
    }
  }

  const loopDone = loop();

  return {
    wake,
    async stop() {
      running = false;
      wake();
      await loopDone;
      await Promise.allSettled([...inFlight]);
      log.info("evidence jobs stopped");
    },
  };
}
