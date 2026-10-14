"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, Icon, Switch } from "@/lib/discovery";
import type {
  BackendCall,
  RecognitionResult,
  RecognitionStatus,
  RecognitionTask,
} from "@/lib/types";
import { elapsedBetween } from "@/lib/format";
import { BackendHealth } from "./backend-health";
import { CallLog } from "./call-log";
import { PhaseBreakdown } from "./phase-breakdown";
import { PlaceList } from "./place-list";
import { SourcePanel } from "./source-panel";
import { Spinner } from "./spinner";
import { StatusHero } from "./status-hero";
import { TextField } from "./text-field";

const POLL_INTERVAL_MS = 1200;
/** Stops a wedged run from polling forever. */
const MAX_POLLS = 150;

const TERMINAL: RecognitionStatus[] = [
  "completed",
  "committed",
  "failed",
  "expired",
  "cancelled",
];

export function RecognitionConsole() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [bypassCache, setBypassCache] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [calls, setCalls] = useState<BackendCall[]>([]);
  const [task, setTask] = useState<RecognitionTask | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const abortRef = useRef<AbortController | null>(null);

  // Wall-clock ticker. Deliberately unanimated — this value changes ~10x/second,
  // and animating at that frequency reads as jitter, not polish.
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [isRunning]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const recordCall = useCallback((call: BackendCall | null | undefined) => {
    if (!call) return;
    setCalls((previous) => [...previous, call]);
  }, []);

  const run = useCallback(async () => {
    const trimmed = sourceUrl.trim();
    if (!trimmed || isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setCalls([]);
    setTask(null);
    setResult(null);
    setFatalError(null);
    setStartedAt(Date.now());
    setNow(Date.now());

    try {
      const startResponse = await fetch("/api/recognitions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: trimmed, bypass_cache: bypassCache }),
        signal: controller.signal,
      });
      const startCall: BackendCall<RecognitionTask> = await startResponse.json();
      recordCall(startCall);

      const recognitionId = startCall.data?.recognition_id;
      if (!startCall.ok || !recognitionId) {
        setFatalError(startCall.error ?? "Backend refused to enqueue the recognition.");
        setIsRunning(false);
        return;
      }
      setTask(startCall.data);

      for (let poll = 0; poll < MAX_POLLS; poll++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (controller.signal.aborted) return;

        const pollResponse = await fetch(
          `/api/recognitions/status?id=${recognitionId}`,
          { signal: controller.signal },
        );
        const payload: {
          status: BackendCall<RecognitionTask>;
          result: BackendCall<RecognitionResult> | null;
        } = await pollResponse.json();

        recordCall(payload.status);
        if (payload.result) recordCall(payload.result);

        if (payload.status.data) setTask(payload.status.data);
        if (payload.result?.data) setResult(payload.result.data);

        const status = payload.status.data?.status;
        if (status && TERMINAL.includes(status)) break;
        if (!payload.status.ok) {
          setFatalError(payload.status.error ?? "Polling failed.");
          break;
        }
      }
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") {
        setFatalError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      setIsRunning(false);
    }
  }, [sourceUrl, bypassCache, isRunning, recordCall]);

  // While running the wall clock is live. Once finished, prefer the backend's own
  // created→finished span: authoritative, and free of the console's poll overhead.
  const wallClockMs =
    startedAt === null
      ? null
      : isRunning
        ? now - startedAt
        : (elapsedBetween(task?.created_at, task?.finished_at) ?? now - startedAt);

  const places = result?.places ?? task?.places ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 pb-20 pt-10 sm:pt-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="ds-title-2">
            Recognition Console
          </h1>
          <p className="text-caption text-grey-800">
            Instagram or TikTok link in, pipeline timings and venues out.
          </p>
        </div>
        <BackendHealth />
      </header>

      <section className="surface-panel flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            disabled={isRunning}
            label="Source URL"
            name="source_url"
            onChange={(event) => setSourceUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void run();
            }}
            placeholder="instagram.com/reel/… or tiktok.com/@user/video/…"
            style={{ flex: 1, minWidth: 0 }}
            type="url"
            value={sourceUrl}
          />

          <Button
            disabled={!sourceUrl.trim() || isRunning}
            leadingIcon={isRunning ? <Spinner label="Running" size={18} /> : null}
            onClick={() => void run()}
            size="lg"
            style={{ flexShrink: 0 }}
          >
            {isRunning ? "Running" : "Run pipeline"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-grey-200 pt-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-caption font-semibold">
            <Switch
              checked={bypassCache}
              disabled={isRunning}
              onChange={setBypassCache}
            />
            Bypass result cache
          </label>
          <p className="text-micro text-grey-800">
            Forces a genuine scrape, analysis, and match run.
          </p>
        </div>
      </section>

      {fatalError ? (
        <div
          className="animate-enter-rise flex items-start gap-2 rounded-card bg-red-500/10 px-4 py-3 text-caption text-ink-primary"
          role="alert"
        >
          <Icon className="mt-0.5 text-red-500" name="circle-alert" size={16} />
          {fatalError}
        </div>
      ) : null}

      {task ? (
        <StatusHero
          callCount={calls.length}
          isRunning={isRunning}
          placeCount={places.length}
          task={task}
          wallClockMs={wallClockMs}
        />
      ) : (
        <NoRunYet />
      )}

      {task ? <PhaseBreakdown isRunning={isRunning} task={task} /> : null}

      {places.length > 0 ? (
        <PlaceList places={places} />
      ) : task && !isRunning && task.status === "completed" ? (
        <EmptyPlaces />
      ) : null}

      {result ? <SourcePanel result={result} /> : null}

      {calls.length > 0 ? <CallLog calls={calls} /> : null}
    </main>
  );
}

function NoRunYet() {
  return (
    <EmptyState
      className="rounded-card border-2 border-dashed border-bone-400"
      headline="No run yet"
      object={
        <span className="flex size-14 items-center justify-center rounded-full bg-bone-300 text-cobalt-500">
          <Icon name="map-pin" size={24} />
        </span>
      }
      sub={
        <span className="text-grey-800">
          Paste an Instagram or TikTok link above. Each stage, every request,
          and the extracted venues appear here as the run progresses.
        </span>
      }
    />
  );
}

function EmptyPlaces() {
  return (
    <section className="animate-enter-rise surface-panel px-4 py-6 text-center text-caption text-grey-800">
      Pipeline completed but extracted no venues from this post.
    </section>
  );
}
