"use client";

import type { RecognitionStatus, RecognitionTask } from "@/lib/types";
import { elapsedBetween, formatDuration } from "@/lib/format";
import { Icon } from "@/lib/discovery";

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

  // Green and red fail AA as text on white, so they colour the glyph only;
  // the label stays ink. Cobalt (7:1 on white) can carry both.
  const glyphColour =
    colour === "success"
      ? "text-green-600"
      : colour === "danger"
        ? "text-red-500"
        : "text-cobalt-500";
  const labelColour = colour === "accent" ? "text-cobalt-500" : "text-ink-primary";

  return (
    <section className="surface-hero animate-enter-rise overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="flex flex-col gap-3">
          <div className={`flex items-center gap-2 text-caption font-semibold ${labelColour}`}>
            <span className={glyphColour}>
              <StatusGlyph status={status} isRunning={isRunning} />
            </span>
            {LABEL[status]}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="numerals-display text-5xl sm:text-6xl">
              {formatDuration(wallClockMs).replace(/[a-z]+$/i, "")}
            </span>
            <span className="text-headline font-semibold text-grey-800">
              {formatDuration(wallClockMs).match(/[a-z]+$/i)?.[0] ?? ""}
            </span>
          </div>

          <p className="font-mono text-micro text-grey-800">{task.recognition_id}</p>
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
        <p className="flex items-start gap-2 bg-red-500/10 px-6 py-3 text-caption text-ink-primary">
          <Icon className="mt-0.5 text-red-500" name="circle-alert" size={16} />
          {task.error_message}
        </p>
      ) : null}

      {task.retry_count > 0 ? (
        <p className="bg-amber-500/15 px-6 py-2 text-micro text-ink-primary">
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
  if (status === "failed" || status === "expired") {
    return <Icon name="circle-alert" size={16} />;
  }
  if (status === "completed" || status === "committed") {
    return <Icon name="check" size={16} />;
  }
  return (
    <Icon
      className={isRunning ? "animate-pulse motion-reduce:animate-none" : ""}
      name="zap"
      size={16}
    />
  );
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
      <dt className="ds-section-label text-grey-800">
        {label}
      </dt>
      <dd
        className={`numerals-display text-headline ${
          emphasised ? "text-cobalt-500" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
