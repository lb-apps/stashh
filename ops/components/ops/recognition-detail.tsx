"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleAlert, ExternalLink, MapPin, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
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
    <section className="grid gap-2">
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

  return (
    <div className="grid gap-5">
      <div className="flex items-start gap-4">
        <Thumb url={detail.source?.thumbnail_url ?? null} icon={SOURCE_ICON[detail.source_type]} className="size-16" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="truncate font-heading text-headline font-black">{formatSource(detail.source_url)}</h2>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Badge variant="success">{SOURCE_TYPE[detail.source_type]}</Badge>
            <Badge variant="outline">{CHANNEL[detail.channel]}</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
      </div>

      <StatGrid
        size="md"
        // Places is one digit, cost is up to "$0.0032": share the width accordingly.
        className="grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.15fr)] sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1.15fr)]"
        stats={[
          { label: "Places", value: detail.places.length },
          { label: "Duration", value: formatDuration(lastRun?.total_ms) },
          { label: "Cost", value: detail.runs.some((r) => r.cost_usd != null) ? formatUsd(cost) : DASH },
        ]}
      />
      <p className="-mt-2 text-caption text-muted-foreground">
        {formatDateTime(detail.created_at)} · waited {formatDuration(waited)} in the queue · {detail.runs.length}{" "}
        {detail.runs.length === 1 ? "attempt" : "attempts"}
      </p>

      {detail.status === "failed" && detail.error_message && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Failed</AlertTitle>
          <AlertDescription>{detail.error_message}</AlertDescription>
        </Alert>
      )}

      <Section label="Extracted places">
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

      <Section label="Attempts">
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

      {detail.source?.caption && <Caption text={detail.source.caption} />}

      {isUrl && (
        <Button asChild>
          <a href={detail.source_url} target="_blank" rel="noreferrer">
            Open source <ExternalLink aria-hidden />
          </a>
        </Button>
      )}

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
        </ItemTitle>
        {run.fetch_method && <span className="micro-label">{FETCH_METHOD[run.fetch_method]}</span>}
        <StepBar run={run} />
        {usage && <ItemDescription className="text-xs">{usage}</ItemDescription>}
        {run.outcome === "failed" && (
          <ItemDescription className="text-caption text-foreground">
            <span className="font-semibold">{stepLabel(run.failed_step)}:</span> {run.error_message ?? "No error message"}
          </ItemDescription>
        )}
      </ItemContent>
      <ItemActions className="numeric self-start text-caption font-bold">{formatDuration(run.total_ms)}</ItemActions>
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

/** shadcn chart-bar-stacked, laid on its side: one bar for the attempt, one segment per step. */
function StepBar({ run }: { run: RecognitionRunDetail }) {
  const segments = STEP_SEGMENTS.filter((segment) => (run[segment.key] ?? 0) > 0);
  if (segments.length === 0) return null;
  const config = Object.fromEntries(segments.map((s) => [s.key, { label: stepLabel(s.step), color: s.color }])) satisfies ChartConfig;
  const row = Object.fromEntries([["attempt", run.attempt], ...segments.map((s) => [s.key, run[s.key]])]);

  return (
    <ChartContainer config={config} className="aspect-auto h-16 w-full">
      <BarChart accessibilityLayer data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={10}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="attempt" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel valueFormatter={formatDuration} />} />
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
        <ChartLegend itemSorter={null} content={<ChartLegendContent className="flex-wrap justify-start gap-x-3 gap-y-1 pt-2" />} />
      </BarChart>
    </ChartContainer>
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
