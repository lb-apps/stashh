"use client";

import type { RecognitionTask } from "@/lib/types";
import { elapsedBetween, formatClock, formatDuration } from "@/lib/format";
import { SectionTitle } from "./section-title";
import { Icon } from "@/lib/discovery";

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

      <div className="surface-panel p-2">
        <ol className="flex flex-col">
          {phases.map((phase, index) => (
            <li
              className="animate-enter-rise relative flex gap-4 px-4 py-3.5"
              key={phase.key}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* Connecting rail — the phases are one continuous run, not three cards. */}
              {index < phases.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute left-[27px] top-9 h-[calc(100%-1rem)] w-px bg-grey-300"
                />
              ) : null}

              <PhaseNode state={phase.state} />

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-caption font-semibold">{phase.label}</span>
                  <span className="shrink-0 font-mono text-micro tabular-nums">
                    {phase.state === "active" ? (
                      <span className="text-cobalt-500">running</span>
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
                  <span className="truncate text-micro text-grey-800">{phase.hint}</span>
                  <span className="shrink-0 font-mono text-nano text-grey-800">
                    {formatClock(phase.at)}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="px-1 text-micro leading-relaxed text-grey-800">
        Per-stage timings inside <span className="font-semibold text-ink-primary">Processing</span>{" "}
        go to the worker&rsquo;s server log, not the API. The console reports only what
        the backend actually returns.
      </p>
    </section>
  );
}

function PhaseNode({ state }: { state: PhaseState }) {
  if (state === "done") {
    return (
      <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-surface-card">
        <Icon name="check" size={14} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-red-500/15">
        <span className="size-2 rounded-full bg-red-500" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="animate-node-pulse relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-cobalt-100">
        <span className="size-2 rounded-full bg-cobalt-500" />
      </span>
    );
  }
  return (
    <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-grey-200">
      <span className="size-1.5 rounded-full bg-grey-500" />
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
      <div className="h-1 overflow-hidden rounded-full bg-grey-200">
        <div className="animate-rail-sweep h-full w-1/3 rounded-full bg-cobalt-500" />
      </div>
    );
  }

  const pct = slowest > 0 && durationMs ? Math.max(2, (durationMs / slowest) * 100) : 0;

  return (
    <div className="h-1 overflow-hidden rounded-full bg-grey-200">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${
          state === "failed" ? "bg-red-500" : "bg-cobalt-500/70"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
