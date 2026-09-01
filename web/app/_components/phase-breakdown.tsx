"use client";

import type { RecognitionTask } from "@/lib/types";
import { elapsedBetween, formatClock, formatDuration } from "@/lib/format";
import { SectionTitle } from "./section-title";
import { CheckIcon } from "./icons";

type PhaseState = "pending" | "active" | "done" | "failed";

interface Phase {
  key: string;
  label: string;
  hint: string;
  state: PhaseState;
  durationMs: number | null;
  at: string | null;
}

function buildPhases(task: RecognitionTask, isRunning: boolean): Phase[] {
  const failed = task.status === "failed" || task.status === "expired";

  return [
    {
      key: "enqueued",
      label: "Enqueued",
      hint: "POST /recognitions, task row written",
      state: "done",
      durationMs: null,
      at: task.created_at,
    },
    {
      key: "queued",
      label: "Waiting for worker",
      hint: "Realtime wake, then claim via RPC",
      state: task.started_at ? "done" : isRunning ? "active" : "pending",
      durationMs: elapsedBetween(task.created_at, task.started_at),
      at: task.started_at,
    },
    {
      key: "processing",
      label: "Processing",
      hint: "Scrape → Gemini → Places match → thumbnails",
      state: task.finished_at
        ? failed
          ? "failed"
          : "done"
        : task.started_at
          ? isRunning
            ? "active"
            : "failed"
          : "pending",
      durationMs: elapsedBetween(task.started_at, task.finished_at),
      at: task.finished_at,
    },
  ];
}

export function PhaseBreakdown({
  task,
  isRunning,
}: {
  task: RecognitionTask;
  isRunning: boolean;
}) {
  const phases = buildPhases(task, isRunning);
  // Bar widths are relative to the slowest phase, so the bottleneck is obvious
  // without reading a single number.
  const slowest = phases.reduce(
    (max, phase) => Math.max(max, phase.durationMs ?? 0),
    0,
  );

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Pipeline</SectionTitle>

      <div className="surface-panel rounded-2xl p-2">
        <ol className="flex flex-col">
          {phases.map((phase, index) => (
            <li
              className="animate-enter-rise relative flex gap-4 rounded-xl px-4 py-3.5"
              key={phase.key}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Connecting rail — the phases are one continuous run, not three cards. */}
              {index < phases.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[27px] top-9 h-[calc(100%-1rem)] w-px bg-[var(--console-hairline)]"
                />
              ) : null}

              <PhaseNode state={phase.state} />

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{phase.label}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums">
                    {phase.state === "active" ? (
                      <span className="text-accent-strong">running</span>
                    ) : (
                      formatDuration(phase.durationMs)
                    )}
                  </span>
                </div>

                <PhaseBar
                  durationMs={phase.durationMs}
                  slowest={slowest}
                  state={phase.state}
                />

                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs text-muted">{phase.hint}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {formatClock(phase.at)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="px-1 text-xs leading-relaxed text-muted">
        Per-stage timings inside <span className="text-foreground">Processing</span>{" "}
        go to the worker&rsquo;s server log, not the API. The console reports only what
        the backend actually returns.
      </p>
    </section>
  );
}

function PhaseNode({ state }: { state: PhaseState }) {
  if (state === "done") {
    return (
      <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckIcon className="size-3.5" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-danger/15">
        <span className="size-2 rounded-full bg-danger" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="animate-node-pulse relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/20">
        <span className="size-2 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/5">
      <span className="size-1.5 rounded-full bg-muted/50" />
    </span>
  );
}

function PhaseBar({
  durationMs,
  slowest,
  state,
}: {
  durationMs: number | null;
  slowest: number;
  state: PhaseState;
}) {
  if (state === "pending") return <div className="h-1" />;

  if (state === "active") {
    return (
      <div className="h-1 overflow-hidden rounded-full bg-white/5">
        <div className="animate-rail-sweep h-full w-1/3 rounded-full bg-accent" />
      </div>
    );
  }

  const pct = slowest > 0 && durationMs ? Math.max(2, (durationMs / slowest) * 100) : 0;

  return (
    <div className="h-1 overflow-hidden rounded-full bg-white/5">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${
          state === "failed" ? "bg-danger" : "bg-accent/70"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
