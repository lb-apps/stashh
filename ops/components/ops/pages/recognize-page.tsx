"use client";

import { CircleAlert, ExternalLink, Link2, MapPinOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useNow } from "@/hooks/use-now";
import { useRecognitionStatus, useStartRecognition } from "@/hooks/use-recognize";
import { formatDuration, formatInt, formatSource } from "@/lib/format";
import { TASK_STATUS } from "@/lib/labels";
import type { TaskStatus } from "@/lib/ops-types";
import { PRESETS, isSupportedLink, isTerminal, type RecognitionStatus } from "@/lib/recognize-types";
import { PageHeader } from "../page-header";
import { Panel } from "../panel";
import { PlaceItem } from "../place-item";
import { StatGrid } from "../stat-grid";
import { StatusDot } from "../status-dot";
import { EmptyState } from "../states";

/** The run on screen. It lives in this component alone: a reload forgets it, by design. */
interface Run {
  id: string;
  sourceUrl: string;
  startedAt: number;
}

/**
 * The link tester: one recognition at a time, sent through the public API as the app
 * would send it, watched until it settles, its places shown as the app would show them.
 */
export function RecognizePage() {
  const [run, setRun] = useState<Run | null>(null);
  const start = useStartRecognition();
  const status = useRecognitionStatus(run?.id ?? null);
  const current = status.data ?? null;
  const running = run !== null && (current === null || !isTerminal(current.status));
  const busy = start.isPending || running;

  return (
    <>
      <PageHeader title="Recognize a link" description="One link at a time, as the app would send it. Nothing is kept." controls={false} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-6">
        <div className="grid gap-4 lg:gap-6">
          <Panel title="Link">
            <LinkForm
              disabled={busy}
              pending={start.isPending}
              error={start.error?.message ?? null}
              onSubmit={(sourceUrl, bypassCache) =>
                start.mutate(
                  { sourceUrl, bypassCache },
                  { onSuccess: (accepted) => setRun({ id: accepted.recognition_id, sourceUrl, startedAt: Date.now() }) },
                )
              }
            />
          </Panel>
          {run && (
            <Panel title="Progress">
              <Progress run={run} status={current} error={status.error?.message ?? null} />
            </Panel>
          )}
        </div>
        <Panel title={current?.places?.length ? `Places · ${formatInt(current.places.length)}` : "Places"}>
          <Places run={run} status={current} />
        </Panel>
      </div>
    </>
  );
}

function LinkForm({
  disabled,
  pending,
  error,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (sourceUrl: string, bypassCache: boolean) => void;
}) {
  const inputId = useId();
  const switchId = useId();
  const [url, setUrl] = useState("");
  const [bypassCache, setBypassCache] = useState(false);
  const [touched, setTouched] = useState(false);
  const trimmed = url.trim();
  const invalid = touched && trimmed !== "" && !isSupportedLink(trimmed);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!trimmed || !isSupportedLink(trimmed)) return;
    onSubmit(trimmed, bypassCache);
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor={inputId} className="micro-label">
          Instagram or TikTok link
        </Label>
        <Input
          id={inputId}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://www.instagram.com/reel/…"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${inputId}-error` : undefined}
        />
        {invalid && (
          <p id={`${inputId}-error`} className="text-caption text-destructive">
            Paste an Instagram post, Reel or IGTV link, or a TikTok video link.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <span className="micro-label">Try one of ours</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.url}
              type="button"
              variant="secondary"
              size="xs"
              disabled={disabled}
              title={preset.detail}
              onClick={() => {
                setUrl(preset.url);
                setTouched(false);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          Stories and posts shared from the Instagram app carry no public link; test those by sharing them to @stashh.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Switch id={switchId} checked={bypassCache} onCheckedChange={setBypassCache} disabled={disabled} />
          <Label htmlFor={switchId} className="text-caption font-semibold">
            Skip the cache
          </Label>
        </div>
        <Button type="submit" disabled={disabled || !trimmed}>
          {pending ? "Starting…" : "Recognize"}
          <Sparkles aria-hidden />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not start</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

const STAGES: { status: TaskStatus; label: string }[] = [
  { status: "queued", label: "Queued" },
  { status: "processing", label: "Processing" },
];

function stageIndex(status: TaskStatus): number {
  if (isTerminal(status)) return STAGES.length;
  return Math.max(0, STAGES.findIndex((stage) => stage.status === status));
}

/** Where the run is: the stages so far, how long it has taken, and what went wrong. */
function Progress({ run, status, error }: { run: Run; status: RecognitionStatus | null; error: string | null }) {
  const now = useNow();
  const state: TaskStatus = status?.status ?? "queued";
  const done = isTerminal(state);
  const badge = TASK_STATUS[state];
  // The shared clock ticks once a second, so right after a start it can trail the start itself.
  const elapsed = Math.max(
    0,
    done && status?.finished_at ? Date.parse(status.finished_at) - Date.parse(status.created_at) : now - run.startedAt,
  );
  const reached = stageIndex(state);
  const stages = [...STAGES.map((stage) => stage.label), done ? badge.label : "Done"];
  const failure = status?.error_message ?? error;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="truncate text-caption text-muted-foreground">{formatSource(run.sourceUrl)}</span>
      </div>

      <ItemGroup role="list" className="gap-1.5">
        {stages.map((label, index) => {
          const tone = index < reached ? "done" : index === reached ? "current" : "next";
          return (
            <Item key={label} role="listitem" variant="muted" size="sm" className="px-3.5 py-2.5">
              <ItemMedia>
                <StatusDot
                  state={tone === "next" ? "unknown" : tone === "current" && !done ? "live" : state === "failed" && tone === "current" ? "down" : "up"}
                  pulse={tone === "current" && !done}
                />
              </ItemMedia>
              <ItemContent>
                <ItemTitle className={tone === "next" ? "text-muted-foreground" : undefined}>{label}</ItemTitle>
              </ItemContent>
            </Item>
          );
        })}
      </ItemGroup>

      <StatGrid
        size="md"
        className="grid-cols-2 sm:grid-cols-2"
        stats={[
          { label: "Elapsed", value: formatDuration(elapsed) },
          { label: "Attempts", value: formatInt((status?.retry_count ?? 0) + 1) },
        ]}
      />

      {failure && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{status?.status === "failed" ? "Recognition failed" : "Could not read the status"}</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      <Button asChild variant="link" size="sm" className="h-auto w-fit p-0">
        <Link href={`/recognitions?id=${run.id}`}>
          Open the run detail <ExternalLink aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

/** The places the backend returned, as the app would list them. */
function Places({ run, status }: { run: Run | null; status: RecognitionStatus | null }) {
  if (!run) {
    return <EmptyState icon={<Link2 />} title="Paste a link to begin" description="The places the backend finds show up here, as the app receives them." />;
  }
  if (!status || !isTerminal(status.status)) {
    return (
      <div className="grid gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-20 w-full rounded-tile" />
        ))}
      </div>
    );
  }
  const places = status.places ?? [];
  if (places.length === 0) {
    if (status.status === "failed") {
      return <EmptyState icon={<CircleAlert />} title="No result" description="The recognition failed; the reason is under Progress." />;
    }
    return (
      <EmptyState
        icon={<MapPinOff />}
        title={status.names_elsewhere ? "Names are on other slides" : "No places found"}
        description={
          status.names_elsewhere
            ? "The post announces several venues but names none in what was read."
            : "Nothing in this post resolved to a business with a Google listing."
        }
      />
    );
  }
  return (
    <ItemGroup role="list" className="gap-2">
      {places.map((place) => (
        <PlaceItem key={place.google_place_id} place={place} />
      ))}
    </ItemGroup>
  );
}
