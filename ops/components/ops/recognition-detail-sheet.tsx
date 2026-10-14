"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, CircleAlert, ExternalLink, MapPin, Star } from "lucide-react";
import Image from "next/image";
import { Suspense, useState, type ReactNode } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemGroup } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH, formatBytes, formatDateTime, formatDuration, formatInt, formatRating, formatSource, formatUsd } from "@/lib/format";
import { CHANNEL, FETCH_METHOD, RUN_OUTCOME, SOURCE_TYPE, TASK_STATUS, stepLabel } from "@/lib/labels";
import type { RecognitionDetail, RecognitionPlace, RecognitionRunDetail } from "@/lib/ops-types";
import { SOURCE_ICON, Thumb } from "./recognition-thumb";
import { StatGrid } from "./stat-grid";

async function getDetail(id: string): Promise<RecognitionDetail> {
  const response = await fetch(`/api/ops/recognitions/${id}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as RecognitionDetail;
}

/**
 * The sheet for the recognition named in the URL (`?id=`). It reads search params in its own
 * Suspense boundary so the page around it hydrates with the layout.
 */
export function RecognitionDetailFromUrl() {
  return (
    <Suspense fallback={null}>
      <SheetForSearchParam />
    </Suspense>
  );
}

function SheetForSearchParam() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const pathname = usePathname();
  return <RecognitionDetailSheet id={id} onClose={() => router.replace(pathname, { scroll: false })} />;
}

/** One recognition's whole story in a side sheet; it refreshes while the task is still running. */
export function RecognitionDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, error, isPending } = useQuery({
    queryKey: ["ops", "recognition", id],
    queryFn: () => getDetail(id!),
    enabled: id != null,
    refetchInterval: (query) => (query.state.data && ["queued", "processing"].includes(query.state.data.status) ? 3_000 : false),
  });

  return (
    <Sheet open={id != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        {data ? (
          <DetailBody detail={data} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{error ? "Could not open the recognition" : "Loading"}</SheetTitle>
              <SheetDescription>{error ? error.message : "Fetching the recognition's details."}</SheetDescription>
            </SheetHeader>
            {isPending && !error && <DetailSkeleton />}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 p-4">
      <div className="flex gap-4">
        <Skeleton className="size-28 rounded-xl" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
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
    <ScrollArea className="h-full">
      <SheetHeader className="gap-3 border-b pb-4">
        <div className="flex gap-4 pr-8">
          <Thumb url={detail.source?.thumbnail_url ?? null} icon={SOURCE_ICON[detail.source_type]} className="size-28 rounded-xl after:rounded-xl" />
          <div className="grid min-w-0 content-start gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="info">{SOURCE_TYPE[detail.source_type]}</Badge>
              <Badge variant="outline">{CHANNEL[detail.channel]}</Badge>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <SheetTitle className="truncate font-mono text-sm font-medium">{formatSource(detail.source_url)}</SheetTitle>
            <SheetDescription className="tabular-nums">
              {formatDateTime(detail.created_at)} · {detail.runs.length} {detail.runs.length === 1 ? "attempt" : "attempts"}
            </SheetDescription>
            {isUrl && (
              <Button asChild variant="outline" size="sm" className="w-fit">
                <a href={detail.source_url} target="_blank" rel="noreferrer">
                  Open source <ExternalLink aria-hidden />
                </a>
              </Button>
            )}
          </div>
        </div>
        <StatGrid
          size="sm"
          className="sm:grid-cols-4"
          stats={[
            { label: "Queue wait", value: formatDuration(waited) },
            { label: "Last attempt", value: formatDuration(lastRun?.total_ms) },
            { label: "Places", value: detail.places.length },
            { label: "Cost", value: detail.runs.some((r) => r.cost_usd != null) ? formatUsd(cost) : DASH },
          ]}
        />
      </SheetHeader>

      <div className="grid gap-6 p-4">
        {detail.status === "failed" && detail.error_message && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>{detail.error_message}</AlertDescription>
          </Alert>
        )}

        {detail.source?.caption && <Caption text={detail.source.caption} />}

        <Section title="Process" description="Every attempt, and how its time split across the steps">
          {detail.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">This recognition ran before runs were recorded; there is no step detail.</p>
          ) : (
            <div className="grid gap-4">
              {detail.runs.map((run) => (
                <RunCard key={run.id} run={run} />
              ))}
            </div>
          )}
        </Section>

        <Separator />

        <Section
          title="Result"
          description={detail.places.length ? `${detail.places.length} ${detail.places.length === 1 ? "place" : "places"} found` : "No places found"}
        >
          {detail.places.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {detail.places.map((place) => (
                <PlaceCard key={place.google_place_id} place={place} />
              ))}
            </div>
          )}
        </Section>

        <Separator />
        <StatGrid
          size="sm"
          className="sm:grid-cols-2"
          stats={[
            { label: "Task", value: <span className="font-mono text-xs">{detail.id}</span> },
            { label: "User", value: <span className="font-mono text-xs">{detail.owner_user_id}</span> },
          ]}
        />
      </div>
    </ScrollArea>
  );
}

/** The post's caption: four lines, the rest behind "Show more". */
function Caption({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 240) {
    return (
      <Section title="Caption">
        <p className="text-sm whitespace-pre-line">{text}</p>
      </Section>
    );
  }
  return (
    <Section title="Caption">
      <Collapsible open={open} onOpenChange={setOpen} className="grid gap-1">
        {!open && <p className="line-clamp-4 text-sm whitespace-pre-line">{text}</p>}
        <CollapsibleContent>
          <p className="text-sm whitespace-pre-line">{text}</p>
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

const STEP_SEGMENTS = [
  { key: "fetch_ms", step: "content fetched", color: "var(--chart-3)" },
  { key: "analysis_ms", step: "media analyzed", color: "var(--chart-1)" },
  { key: "match_ms", step: "places found", color: "var(--chart-2)" },
  { key: "thumbnails_ms", step: "thumbnails saved", color: "var(--chart-4)" },
  { key: "save_ms", step: "result saved", color: "var(--muted-foreground)" },
] as const;

/** shadcn chart-bar-stacked, laid on its side: one bar for the attempt, one segment per step. */
function StepBar({ run }: { run: RecognitionRunDetail }) {
  const segments = STEP_SEGMENTS.filter((segment) => (run[segment.key] ?? 0) > 0);
  if (segments.length === 0) return null;
  const config = Object.fromEntries(segments.map((s) => [s.key, { label: stepLabel(s.step), color: s.color }])) satisfies ChartConfig;
  const row = Object.fromEntries([["attempt", run.attempt], ...segments.map((s) => [s.key, run[s.key]])]);

  return (
    <ChartContainer config={config} className="aspect-auto h-16 w-full">
      <BarChart accessibilityLayer data={[row]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={12}>
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis type="category" dataKey="attempt" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel valueFormatter={formatDuration} />} />
        {segments.map((segment, index) => (
          <Bar
            key={segment.key}
            dataKey={segment.key}
            stackId="steps"
            fill={`var(--color-${segment.key})`}
            radius={segments.length === 1 ? 6 : index === 0 ? [6, 0, 0, 6] : index === segments.length - 1 ? [0, 6, 6, 0] : 0}
            isAnimationActive={false}
          />
        ))}
        <ChartLegend itemSorter={null} content={<ChartLegendContent className="flex-wrap gap-x-4 gap-y-1 pt-2" />} />
      </BarChart>
    </ChartContainer>
  );
}

/** One attempt: outcome, its time by step, and what the model used. */
function RunCard({ run }: { run: RecognitionRunDetail }) {
  const outcome = RUN_OUTCOME[run.outcome];

  return (
    <Card size="sm" className="bg-muted/50 shadow-none">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Attempt {run.attempt}
          <Badge variant={outcome.variant}>{outcome.label}</Badge>
          {run.fetch_method && <Badge variant="outline">{FETCH_METHOD[run.fetch_method]}</Badge>}
        </CardTitle>
        <CardAction className="text-sm font-medium tabular-nums">{formatDuration(run.total_ms)}</CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <StepBar run={run} />
        {run.model && (
          <StatGrid
            size="sm"
            className="sm:grid-cols-4 *:bg-card"
            stats={[
              { label: "Model", value: run.model.replace(/^google\//, "") },
              {
                label: "Media",
                value: `${run.media_kind === "image" ? "Image" : run.media_kind === "video" ? "Video" : DASH} · ${formatBytes(run.media_bytes)}`,
              },
              { label: "Tokens", value: formatInt((run.prompt_tokens ?? 0) + (run.completion_tokens ?? 0)) },
              { label: "Cost", value: formatUsd(run.cost_usd) },
            ]}
          />
        )}
        {run.outcome === "failed" && (
          <Alert variant="destructive" className="bg-card">
            <CircleAlert />
            <AlertTitle>{stepLabel(run.failed_step)}</AlertTitle>
            <AlertDescription>{run.error_message ?? "No error message"}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/** A found place the way the person sees it: photo, name, rating, address, links, tips. */
function PlaceCard({ place }: { place: RecognitionPlace }) {
  const maps =
    place.google_maps_uri ??
    `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: place.name, query_place_id: place.google_place_id })}`;
  return (
    <Card className="pt-0">
      <AspectRatio ratio={16 / 9} className="bg-muted">
        {place.thumbnail_url ? (
          <Image src={place.thumbnail_url} alt="" fill sizes="(min-width: 640px) 320px, 100vw" className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <MapPin aria-hidden className="size-6" />
          </div>
        )}
      </AspectRatio>
      <CardHeader>
        <CardTitle className="font-heading font-semibold">{place.name}</CardTitle>
        {place.address && <CardDescription className="line-clamp-2 text-xs">{place.address}</CardDescription>}
        {place.rating != null && (
          <CardAction className="flex items-center gap-1 text-sm tabular-nums">
            <Star aria-hidden className="size-3.5 fill-current" />
            {formatRating(place.rating)}
          </CardAction>
        )}
      </CardHeader>
      {place.recommendations && place.recommendations.length > 0 && (
        <CardContent>
          <ItemGroup>
            {place.recommendations.slice(0, 3).map((tip) => (
              <Item key={tip.summary} role="listitem" variant="muted" size="xs">
                <ItemContent>
                  <ItemDescription className="text-xs text-foreground">{tip.summary}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      )}
      <CardFooter className="flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={maps} target="_blank" rel="noreferrer">
            Open in Maps <ExternalLink aria-hidden />
          </a>
        </Button>
        {place.instagram_username && (
          <Button asChild variant="ghost" size="sm">
            <a href={`https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/`} target="_blank" rel="noreferrer">
              @{place.instagram_username}
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
