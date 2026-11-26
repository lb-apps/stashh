"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, CircleAlert, ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { DASH, formatBytes, formatDateTime, formatDuration, formatInt, formatSource, formatUsd } from "@/lib/format";
import { CHANNEL, FETCH_METHOD, MENU_STATUS, RUN_OUTCOME, SOURCE_TYPE, TASK_STATUS, menuTypeLabel, stepLabel } from "@/lib/labels";
import type { MenuDetail, MenuDetailCategory, PlaceMenuSummary, RecognitionDetail, RecognitionRunDetail, TranscriptSegment } from "@/lib/ops-types";
import { STEP_COLORS } from "./charts/shared";
import { PlaceItem } from "./place-item";
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

      {detail.transcript && <TranscriptSection transcript={detail.transcript} />}

      {detail.menus && Object.keys(detail.menus).length > 0 && <MenuDiscoverySection detail={detail} />}

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

function MenuDiscoverySection({ detail }: { detail: RecognitionDetail }) {
  const menus = detail.menus!;
  const totalMenus = Object.values(menus).reduce((sum, list) => sum + list.length, 0);
  return (
    <Section label={`Menu discovery · ${totalMenus}`}>
      <ItemGroup className="gap-2">
        {detail.places.map((place) => {
          const placeMenus = menus[place.google_place_id];
          if (!placeMenus || placeMenus.length === 0) return null;
          return (
            <Item key={place.google_place_id} variant="muted" size="sm" className="px-3.5 py-3">
              <ItemContent className="min-w-0 gap-2">
                <ItemTitle className="font-heading text-body font-bold">{place.name}</ItemTitle>
                <div className="grid gap-2">
                  {placeMenus.map((menu) => (
                    <MenuSummaryItem key={menu.id} menu={menu} />
                  ))}
                </div>
              </ItemContent>
            </Item>
          );
        })}
      </ItemGroup>
    </Section>
  );
}

async function getMenuDetail(id: string): Promise<MenuDetail> {
  const response = await fetch(`/api/ops/menus/${id}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as MenuDetail | null;
  if (!response.ok || !body) throw new Error(`HTTP ${response.status}`);
  return body;
}

function useMenuDetail(id: string | null) {
  return useQuery({
    queryKey: ["ops", "menu-detail", id],
    queryFn: () => getMenuDetail(id!),
    enabled: id != null,
    staleTime: 60_000,
  });
}

function MenuSummaryItem({ menu }: { menu: PlaceMenuSummary }) {
  const ms = MENU_STATUS[menu.status];
  const isDone = menu.status === "done";
  const [expanded, setExpanded] = useState(false);
  const activeId = expanded && isDone ? menu.id : null;
  const { data: detail, isLoading } = useMenuDetail(activeId);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={ms.variant}>{ms.label}</Badge>
        <span className="text-caption font-semibold">{menuTypeLabel(menu.menu_type)}</span>
        {isDone && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="numeric ml-auto flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
          >
            {formatInt(menu.categories_count)} categories · {formatInt(menu.items_count)} items
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        )}
      </div>
      {menu.source_url && (
        <a
          href={menu.source_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-caption text-muted-foreground hover:text-primary"
        >
          <span className="min-w-0 truncate">{formatSource(menu.source_url)}</span>
          <ExternalLink aria-hidden className="size-3 shrink-0" />
        </a>
      )}
      {menu.status === "failed" && menu.error_message && (
        <p className="text-caption text-muted-foreground">{menu.error_message}</p>
      )}
      {expanded && isDone && (
        <div className="mt-1">
          {isLoading && <Skeleton className="h-20 w-full" />}
          {detail && <ParsedMenuContent detail={detail} />}
        </div>
      )}
    </div>
  );
}

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return DASH;
  if (currency === "TRY") return `₺${price.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  return `${price.toLocaleString("en-US", { minimumFractionDigits: 2 })} ${currency}`;
}

function ParsedMenuContent({ detail }: { detail: MenuDetail }) {
  const categories = detail.menu_categories ?? [];
  if (categories.length === 0) return <p className="text-caption text-muted-foreground">No parsed categories.</p>;

  return (
    <div className="grid gap-3">
      {categories
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((cat) => (
          <MenuCategoryBlock key={cat.id} category={cat} />
        ))}
    </div>
  );
}

function MenuCategoryBlock({ category }: { category: MenuDetailCategory }) {
  const [open, setOpen] = useState(false);
  const items = category.menu_items ?? [];
  const hasItems = items.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-left hover:bg-muted"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
          <span className="flex-1 font-heading text-caption font-bold">
            {category.name}
            {category.name_en && category.name !== category.name_en && (
              <span className="ml-1.5 font-normal text-muted-foreground">{category.name_en}</span>
            )}
          </span>
          <span className="numeric text-caption text-muted-foreground">{items.length}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {hasItems && (
          <div className="grid gap-1 pl-5 pt-1">
            {items
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((item) => (
                <div key={item.id} className="flex items-start gap-2 py-1">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="mt-0.5 size-10 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  )}
                  <span className="min-w-0 flex-1 text-caption">
                    {item.name}
                    {item.name_en && item.name !== item.name_en && (
                      <span className="ml-1 text-muted-foreground">{item.name_en}</span>
                    )}
                    {item.description && <span className="block text-muted-foreground">— {item.description}</span>}
                  </span>
                  <span className="numeric shrink-0 text-caption font-semibold">{formatPrice(item.price, item.currency)}</span>
                </div>
              ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TranscriptSection({ transcript }: { transcript: { full_text: string; segments: TranscriptSegment[] } }) {
  const [open, setOpen] = useState(false);
  const hasSegments = transcript.segments.length > 0;
  return (
    <Section label={`Transcript · ${transcript.segments.length} segments`}>
      <Collapsible open={open} onOpenChange={setOpen} className="grid gap-2">
        <p className={`text-caption whitespace-pre-line ${!open ? "line-clamp-4" : ""}`}>{transcript.full_text}</p>
        {hasSegments && (
          <CollapsibleContent>
            <div className="mt-2 grid gap-1">
              {transcript.segments.map((seg, i) => (
                <div key={i} className="flex items-start gap-2 text-caption">
                  <span className="numeric shrink-0 text-muted-foreground">{formatTimestamp(seg.start_s)}</span>
                  <span>{seg.text}</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}
        <CollapsibleTrigger asChild>
          <Button variant="link" size="sm" className="h-auto w-fit p-0">
            {open ? "Hide segments" : "Show segments"}
            <ChevronDown aria-hidden className={open ? "rotate-180" : undefined} />
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
    </Section>
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
