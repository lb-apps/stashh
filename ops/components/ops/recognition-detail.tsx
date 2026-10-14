"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleAlert, ExternalLink, MapPin, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH, formatBytes, formatDateTime, formatDuration, formatInt, formatRating, formatSource, formatUsd } from "@/lib/format";
import { CHANNEL, FETCH_METHOD, RUN_OUTCOME, SOURCE_TYPE, TASK_STATUS, stepLabel } from "@/lib/labels";
import type { RecognitionDetail, RecognitionPlace, RecognitionRunDetail } from "@/lib/ops-types";
import { STEP_COLORS } from "./charts/shared";
import { SOURCE_ICON, Thumb } from "./recognition-thumb";
import { StatGrid } from "./stat-grid";

async function getDetail(id: string): Promise<RecognitionDetail> {
  const response = await fetch(`/api/ops/recognitions/${id}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as RecognitionDetail;
}

/** One recognition's detail; it refreshes while the task is still running. */
function useRecognitionDetail(id: string | null) {
  return useQuery({
    queryKey: ["ops", "recognition", id],
    queryFn: () => getDetail(id!),
    enabled: id != null,
    refetchInterval: (query) => (query.state.data && ["queued", "processing"].includes(query.state.data.status) ? 3_000 : false),
  });
}

/** One recognition's whole story in a side sheet (a dialog), opened from any runs list. */
export function RecognitionDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error } = useRecognitionDetail(id);
  return (
    <Sheet open={id != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <ScrollArea className="h-full">
          <SheetHeader className="sr-only">
            <SheetTitle>{data ? formatSource(data.source_url) : "Recognition"}</SheetTitle>
            <SheetDescription>{data ? `${SOURCE_TYPE[data.source_type]} from ${CHANNEL[data.channel]}` : "Loading the recognition"}</SheetDescription>
          </SheetHeader>
          <div className="p-6 pr-12">{data ? <DetailBody detail={data} /> : <DetailPending error={error} />}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function DetailPending({ error }: { error: Error | null }) {
  if (error) {
    return (
      <div className="grid gap-4">
        <p className="font-heading text-headline">Could not open the recognition</p>
        <p className="text-caption text-muted-foreground">{error.message}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-4">
        <Skeleton className="size-16" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-[72px]" />
        <Skeleton className="h-[72px]" />
        <Skeleton className="h-[72px]" />
      </div>
      <Skeleton className="h-28" />
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="micro-label">{label}</h3>
      {children}
    </section>
  );
}

function DetailBody({ detail }: { detail: RecognitionDetail }) {
  const status = TASK_STATUS[detail.status];
  const firstRun = detail.runs[0];
  const lastRun = detail.runs.at(-1);
  const waited = firstRun ? Date.parse(firstRun.started_at) - Date.parse(detail.created_at) : null;
  const cost = detail.runs.reduce((sum, run) => sum + (run.cost_usd ?? 0), 0);
  const isUrl = detail.source_url.startsWith("http");

  // Read top to bottom: what was read (source, caption), what was found, how the run went.
  return (
    <div className="grid gap-8">
      <div className="flex items-start gap-4">
        <Thumb url={detail.source?.thumbnail_url ?? null} icon={SOURCE_ICON[detail.source_type]} className="size-16" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="min-w-0 font-heading text-headline font-black">
            {isUrl ? (
              <a
                href={detail.source_url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1.5 rounded-tile hover:text-primary focus-visible:outline-solid focus-visible:outline-3 focus-visible:outline-cobalt-300"
              >
                <span className="min-w-0 truncate">{formatSource(detail.source_url)}</span>
                <ExternalLink aria-hidden className="size-4 shrink-0" />
                <span className="sr-only">(opens the source)</span>
              </a>
            ) : (
              <span className="block truncate">{formatSource(detail.source_url)}</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Badge variant="success">{SOURCE_TYPE[detail.source_type]}</Badge>
            <Badge variant="outline">{CHANNEL[detail.channel]}</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
      </div>

      {detail.status === "failed" && detail.error_message && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>{detail.error_message}</AlertDescription>
        </Alert>
      )}

      {detail.source?.caption && <Caption text={detail.source.caption} />}

      <Section label={detail.places.length ? `Extracted places · ${detail.places.length}` : "Extracted places"}>
        {detail.places.length === 0 ? (
          <p className="text-caption text-muted-foreground">No places resolved from this source.</p>
        ) : (
          <ItemGroup className="gap-2">
            {detail.places.map((place) => (
              <PlaceItem key={place.google_place_id} place={place} />
            ))}
          </ItemGroup>
        )}
      </Section>

      <Section label="Process">
        <StatGrid
          size="md"
          className="grid-cols-2 sm:grid-cols-2"
          stats={[
            { label: "Duration", value: formatDuration(lastRun?.total_ms) },
            { label: "Cost", value: detail.runs.some((r) => r.cost_usd != null) ? formatUsd(cost) : DASH },
          ]}
        />
        <p className="text-caption text-muted-foreground">
          {formatDateTime(detail.created_at)} · waited {formatDuration(waited)} in the queue
        </p>
        {detail.runs.length === 0 ? (
          <p className="text-caption text-muted-foreground">This recognition ran before attempts were recorded.</p>
        ) : (
          <ItemGroup className="gap-2">
            {detail.runs.map((run) => (
              <RunItem key={run.id} run={run} />
            ))}
          </ItemGroup>
        )}
      </Section>
    </div>
  );
}

/** A found place as a sunken row: photo, name, rating, where it is, what to order. */
function PlaceItem({ place }: { place: RecognitionPlace }) {
  const maps =
    place.google_maps_uri ??
    `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place.name, query_place_id: place.google_place_id })}`;
  const meta = [place.category, place.district].filter(Boolean).join(" · ");
  return (
    <Item role="listitem" variant="muted" size="sm" className="items-start px-3.5 py-3">
      <ItemMedia>
        <Thumb url={place.thumbnail_url ?? null} icon={MapPin} className="size-12" />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-0.5">
        <ItemTitle className="w-full font-heading text-body font-bold">
          <span className="truncate">{place.name}</span>
          {place.rating != null && (
            <Badge variant="success" className="ml-auto">
              <Star aria-hidden className="fill-current" />
              {formatRating(place.rating)}
            </Badge>
          )}
        </ItemTitle>
        {place.address && <ItemDescription className="line-clamp-1 text-caption">{place.address}</ItemDescription>}
        {meta && <span className="micro-label pt-1">{meta}</span>}
        {place.recommendations && place.recommendations.length > 0 && (
          <div className="mt-1.5 grid gap-0.5 text-caption">
            {place.recommendations.slice(0, 3).map((tip) => (
              <p key={tip.summary}>{tip.summary}</p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <Button asChild variant="outline" size="xs">
            <a href={maps} target="_blank" rel="noreferrer">
              Maps <ExternalLink aria-hidden />
            </a>
          </Button>
          {place.instagram_username && (
            <Button asChild variant="ghost" size="xs">
              <a href={`https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/`} target="_blank" rel="noreferrer">
                @{place.instagram_username}
              </a>
            </Button>
          )}
        </div>
      </ItemContent>
    </Item>
  );
}

/** One attempt: outcome, how its time split across the steps, what the model used. */
function RunItem({ run }: { run: RecognitionRunDetail }) {
  const outcome = RUN_OUTCOME[run.outcome];
  const usage = run.model
    ? [
        run.model.replace(/^google\//, ""),
        `${run.media_kind === "image" ? "image" : run.media_kind === "video" ? "video" : "media"} ${formatBytes(run.media_bytes)}`,
        `${formatInt((run.prompt_tokens ?? 0) + (run.completion_tokens ?? 0))} tokens`,
        formatUsd(run.cost_usd),
      ].join(" · ")
    : null;

  return (
    <Item role="listitem" variant="muted" size="sm" className="px-3.5 py-3">
      <ItemContent className="min-w-0 gap-2">
        <ItemTitle className="w-full font-heading text-body font-bold">
          Attempt {run.attempt}
          <Badge variant={outcome.variant}>{outcome.label}</Badge>
          <span className="numeric ml-auto text-caption font-bold">{formatDuration(run.total_ms)}</span>
        </ItemTitle>
        {run.fetch_method && <span className="micro-label">{FETCH_METHOD[run.fetch_method]}</span>}
        <StepBar run={run} />
        {usage && <ItemDescription>{usage}</ItemDescription>}
        {run.outcome === "failed" && (
          <ItemDescription className="text-caption text-foreground">
            <span className="font-semibold">{stepLabel(run.failed_step)}:</span> {run.error_message ?? "No error message"}
          </ItemDescription>
        )}
      </ItemContent>
    </Item>
  );
}

const STEP_SEGMENTS = [
  { key: "fetch_ms", step: "content fetched", color: STEP_COLORS.fetch },
  { key: "analysis_ms", step: "media analyzed", color: STEP_COLORS.analysis },
  { key: "match_ms", step: "places found", color: STEP_COLORS.match },
  { key: "thumbnails_ms", step: "thumbnails saved", color: STEP_COLORS.thumbnails },
  { key: "save_ms", step: "result saved", color: STEP_COLORS.save },
] as const;

/**
 * shadcn chart-bar-stacked, laid on its side: one bar for the attempt, one segment per step.
 * Each step's time sits in the legend below it, always visible, so there is no hover
 * tooltip to cover anything.
 */
function StepBar({ run }: { run: RecognitionRunDetail }) {
  const segments = STEP_SEGMENTS.filter((segment) => (run[segment.key] ?? 0) > 0);
  if (segments.length === 0) return null;
  const config = Object.fromEntries(segments.map((s) => [s.key, { label: stepLabel(s.step), color: s.color }])) satisfies ChartConfig;
  const row = Object.fromEntries([["attempt", run.attempt], ...segments.map((s) => [s.key, run[s.key]])]);

  return (
    <div className="grid gap-2.5">
      <ChartContainer config={config} className="aspect-auto h-2.5 w-full" aria-hidden>
        <BarChart data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={10} accessibilityLayer={false}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="attempt" hide />
          {segments.map((segment, index) => (
            <Bar
              key={segment.key}
              dataKey={segment.key}
              stackId="steps"
              fill={`var(--color-${segment.key})`}
              radius={segments.length === 1 ? 999 : index === 0 ? [999, 0, 0, 999] : index === segments.length - 1 ? [0, 999, 999, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <div className="grid gap-1 text-caption">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: segment.color }} />
            <span className="flex-1">{stepLabel(segment.step)}</span>
            <span className="numeric font-bold text-muted-foreground">{formatDuration(run[segment.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The post's caption: four lines, the rest behind "Show more". */
function Caption({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 240) {
    return (
      <Section label="Caption">
        <p className="text-caption whitespace-pre-line">{text}</p>
      </Section>
    );
  }
  return (
    <Section label="Caption">
      <Collapsible open={open} onOpenChange={setOpen} className="grid gap-1">
        {!open && <p className="line-clamp-4 text-caption whitespace-pre-line">{text}</p>}
        <CollapsibleContent>
          <p className="text-caption whitespace-pre-line">{text}</p>
        </CollapsibleContent>
        <CollapsibleTrigger asChild>
          <Button variant="link" size="sm" className="h-auto w-fit p-0">
            {open ? "Show less" : "Show more"}
            <ChevronDown aria-hidden className={open ? "rotate-180" : undefined} />
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
    </Section>
  );
}
