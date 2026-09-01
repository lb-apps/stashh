"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input, Label, Spinner, Switch, TextField } from "@heroui/react";
import type {
  BackendCall,
  RecognitionResult,
  RecognitionStatus,
  RecognitionTask,
} from "@/lib/types";
import { elapsedBetween } from "@/lib/format";
import { BackendHealth } from "./_components/backend-health";
import { CallLog } from "./_components/call-log";
import { PhaseBreakdown } from "./_components/phase-breakdown";
import { PlaceList } from "./_components/place-list";
import { SourcePanel } from "./_components/source-panel";
import { StatusHero } from "./_components/status-hero";
import { PinIcon } from "./_components/icons";
import { IconContext } from "@phosphor-icons/react";

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

export default function RecognitionConsole() {
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
    // One icon family, one weight, set once. Bold reads correctly at the 12-14px
    // sizes this console uses; regular goes mushy below ~16px.
    <IconContext.Provider value={{ weight: "bold", size: "1em" }}>
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7 px-5 pb-20 pt-10 sm:pt-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[26px] font-semibold leading-none tracking-[-0.02em]">
            Recognition Console
          </h1>
          <p className="text-[13px] text-muted">
            Instagram or TikTok link in, pipeline timings and venues out.
          </p>
        </div>
        <BackendHealth />
      </header>

      <section className="surface-panel flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <TextField
            className="min-w-0 flex-1"
            isDisabled={isRunning}
            name="source_url"
            onChange={setSourceUrl}
            type="url"
            value={sourceUrl}
          >
            <Label className="text-[12px] font-medium text-muted">
              Source URL
            </Label>
            <Input
              className="w-full font-mono text-sm"
              onKeyDown={(event) => {
                if (event.key === "Enter") void run();
              }}
              placeholder="instagram.com/reel/… or tiktok.com/@user/video/…"
            />
          </TextField>

          <Button
            className="press h-11 shrink-0 px-6"
            isDisabled={!sourceUrl.trim() || isRunning}
            onPress={() => void run()}
            variant="primary"
          >
            {isRunning ? (
              <>
                <Spinner size="sm" />
                Running
              </>
            ) : (
              "Run pipeline"
            )}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--console-hairline)] pt-3">
          <Switch
            isDisabled={isRunning}
            isSelected={bypassCache}
            onChange={setBypassCache}
          >
            <Switch.Content className="text-[13px]">
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Bypass result cache
            </Switch.Content>
          </Switch>
          <p className="text-xs text-muted">
            Forces a genuine scrape, analysis, and match run.
          </p>
        </div>
      </section>

      {fatalError ? (
        <div
          className="animate-enter-rise rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
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
        <EmptyState />
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
    </IconContext.Provider>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--console-hairline)] px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-white/5 text-muted/60">
        <PinIcon className="size-5" />
      </span>
      <p className="text-sm font-medium">No run yet</p>
      <p className="max-w-xs text-[13px] leading-relaxed text-muted">
        Paste an Instagram or TikTok link above. Each stage, every request, and the
        extracted venues appear here as the run progresses.
      </p>
    </section>
  );
}

function EmptyPlaces() {
  return (
    <section className="animate-enter-rise surface-panel rounded-2xl px-4 py-6 text-center text-sm text-muted">
      Pipeline completed but extracted no venues from this post.
    </section>
  );
}
