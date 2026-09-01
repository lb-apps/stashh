"use client";

import type { RecognitionStatus, RecognitionTask } from "@/lib/types";
import { elapsedBetween, formatDuration } from "@/lib/format";
import { AlertIcon, BoltIcon, CheckIcon } from "./icons";

const LABEL: Record<RecognitionStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  committed: "Committed",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};

function tone(status: RecognitionStatus): "accent" | "success" | "danger" {
  if (status === "failed" || status === "expired") return "danger";
  if (status === "completed" || status === "committed") return "success";
  return "accent";
}

/**
 * The one thing worth seeing from across the room: is it running, how long has it
 * taken, and how many venues came out. Everything else on the page is detail.
 */
export function StatusHero({
  task,
  isRunning,
  wallClockMs,
  placeCount,
  callCount,
}: {
  task: RecognitionTask;
  isRunning: boolean;
  wallClockMs: number | null;
  placeCount: number;
  callCount: number;
}) {
  const status = task.status;
  const colour = tone(status);
  const queueMs = elapsedBetween(task.created_at, task.started_at);
  const workMs = elapsedBetween(task.started_at, task.finished_at);

  const accentText =
    colour === "success"
      ? "text-success"
      : colour === "danger"
        ? "text-danger"
        : "text-accent-strong";

  return (
    <section className="surface-hero animate-enter-rise overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="flex flex-col gap-3">
          <div className={`flex items-center gap-2 text-sm font-medium ${accentText}`}>
            <StatusGlyph status={status} isRunning={isRunning} />
            {LABEL[status]}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="numerals-display text-5xl font-semibold sm:text-6xl">
              {formatDuration(wallClockMs).replace(/[a-z]+$/i, "")}
            </span>
            <span className="text-xl font-medium text-muted">
              {formatDuration(wallClockMs).match(/[a-z]+$/i)?.[0] ?? ""}
            </span>
          </div>

          <p className="font-mono text-xs text-muted">{task.recognition_id}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          <Metric label="Queue" value={formatDuration(queueMs)} />
          <Metric
            label="Work"
            value={isRunning && !workMs ? "…" : formatDuration(workMs)}
          />
          <Metric label="Requests" value={String(callCount)} />
          <Metric
            label="Venues"
            emphasised={placeCount > 0}
            value={String(placeCount)}
          />
        </dl>
      </div>

      {task.error_message ? (
        <p className="flex items-start gap-2 border-t border-danger/25 bg-danger/10 px-6 py-3 text-sm text-danger">
          <AlertIcon className="mt-0.5" />
          {task.error_message}
        </p>
      ) : null}

      {task.retry_count > 0 ? (
        <p className="border-t border-warning/25 bg-warning/10 px-6 py-2 text-xs text-warning">
          Retried {task.retry_count}{" "}
          {task.retry_count === 1 ? "time" : "times"}.
        </p>
      ) : null}
    </section>
  );
}

function StatusGlyph({
  status,
  isRunning,
}: {
  status: RecognitionStatus;
  isRunning: boolean;
}) {
  if (status === "failed" || status === "expired") return <AlertIcon />;
  if (status === "completed" || status === "committed") return <CheckIcon />;
  return <BoltIcon className={isRunning ? "animate-pulse" : ""} />;
}

function Metric({
  label,
  value,
  emphasised = false,
}: {
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd
        className={`numerals-display text-lg font-semibold ${
          emphasised ? "text-accent-strong" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
