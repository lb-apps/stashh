"use client";

import {
  Activity,
  CircleDollarSign,
  Gauge,
  Hourglass,
  Inbox,
  MapPinOff,
  MessageCircle,
  Timer,
  TriangleAlert,
  Users,
} from "lucide-react";
import { MapPin, Star } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { DASH, formatCompact, formatDecimal, formatDuration, formatInt, formatRating, formatShare, formatUsd } from "@/lib/format";
import { CHANNEL, FETCH_METHOD, SOURCE_TYPE, stepLabel } from "@/lib/labels";
import { PREVIOUS_LABELS, type InstagramOps, type RecognitionOps } from "@/lib/ops-types";
import { trend } from "@/lib/trend";
import { DonutChart } from "./charts/donut-chart";
import { CATEGORY_COLORS } from "./charts/shared";
import { HorizontalBarChart } from "./charts/horizontal-bar-chart";
import { RadialGauge } from "./charts/radial-gauge";
import { KpiCard, KpiCardSkeleton, KpiGrid } from "./kpi-card";
import { Panel } from "./panel";
import { Thumb } from "./recognition-thumb";
import { StatGrid } from "./stat-grid";
import { EmptyState } from "./states";

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <KpiGrid>
      {Array.from({ length: count }, (_, index) => (
        <KpiCardSkeleton key={index} />
      ))}
    </KpiGrid>
  );
}

export function PanelSkeleton({ className, height = "h-64" }: { className?: string; height?: string }) {
  return (
    <Panel title="Loading" className={className}>
      <Skeleton className={`${height} w-full`} />
    </Panel>
  );
}

/* ── KPI cards ───────────────────────────────────────────────────────────── */

export function RequestsKpi({ ops }: { ops: RecognitionOps }) {
  const { totals, runs, previous, series } = ops.stats;
  return (
    <KpiCard
      icon={Activity}
      label="Recognition requests"
      value={formatInt(totals.requests)}
      detail={`Cache ${formatShare(runs.cache_hits, runs.cache_hits + runs.completed)} · ${formatInt(totals.unique_sources)} unique sources`}
      trend={trend(totals.requests, previous.requests, "up")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
      spark={series.map((p) => p.requests)}
    />
  );
}

export function ProcessingKpi({ ops }: { ops: RecognitionOps }) {
  const { runs, previous, series } = ops.stats;
  return (
    <KpiCard
      icon={Timer}
      label="Processing time (p50)"
      value={formatDuration(runs.processing_p50_ms)}
      detail={`p95 ${formatDuration(runs.processing_p95_ms)} · cache ${formatDuration(runs.cache_p50_ms)}`}
      trend={trend(runs.processing_p50_ms, previous.processing_p50_ms, "down")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
      spark={series.map((p) => p.processing_p50_ms)}
    />
  );
}

export function FailureKpi({ ops }: { ops: RecognitionOps }) {
  const { totals, previous, series } = ops.stats;
  return (
    <KpiCard
      icon={TriangleAlert}
      label="Failure rate"
      value={formatShare(totals.failed, totals.requests)}
      detail={`${formatInt(totals.failed)} failed · ${formatInt(totals.retried)} retried`}
      trend={trend(ratio(totals.failed, totals.requests), ratio(previous.failed, previous.requests), "down")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
      spark={series.map((p) => p.failed)}
      sparkTone="danger"
    />
  );
}

export function CostKpi({ ops }: { ops: RecognitionOps }) {
  const { runs, previous, series } = ops.stats;
  const perRun = runs.completed > 0 ? runs.cost_usd / runs.completed : null;
  return (
    <KpiCard
      icon={CircleDollarSign}
      label="Model cost"
      value={formatUsd(runs.cost_usd)}
      detail={`${formatInt(runs.model_calls)} calls · ${formatCompact(runs.prompt_tokens + runs.completion_tokens)} tokens · ${formatUsd(perRun)} per run`}
      trend={trend(runs.cost_usd, previous.cost_usd, "neutral")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
      spark={series.map((p) => p.cost_usd)}
    />
  );
}

export function UsersKpi({ ops }: { ops: RecognitionOps }) {
  const { totals, previous, users } = ops.stats;
  return (
    <KpiCard
      icon={Users}
      label="Active users"
      value={formatInt(totals.active_users)}
      detail={`${formatInt(users.total)} total · ${formatInt(users.new)} new (${formatInt(users.new_instagram)} via Instagram)`}
      trend={trend(totals.active_users, previous.active_users, "up")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
    />
  );
}

export function ZeroResultKpi({ ops }: { ops: RecognitionOps }) {
  const { runs, previous } = ops.stats;
  return (
    <KpiCard
      icon={MapPinOff}
      label="Zero-result rate"
      value={formatShare(runs.zero_results, runs.completed)}
      detail={`${formatInt(runs.zero_results)} runs found no place · avg ${runs.completed ? formatDecimal(runs.places_extracted / runs.completed) : DASH} places`}
      trend={trend(ratio(runs.zero_results, runs.completed), ratio(previous.zero_results, previous.completed_runs), "down")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
    />
  );
}

/** "42 s" — the age of the oldest item still waiting. */
function useAge(iso: string | null): string {
  const now = useNow();
  return iso ? formatDuration(now - Date.parse(iso)) : DASH;
}

export function QueueKpi({ ops }: { ops: RecognitionOps }) {
  const { live } = ops.stats;
  const oldest = useAge(live.oldest_queued_at);
  return (
    <KpiCard
      icon={Inbox}
      label="Queued"
      value={formatInt(live.queued)}
      detail={live.queued > 0 ? `${formatInt(live.processing)} processing · oldest ${oldest}` : `${formatInt(live.processing)} processing · worker ×${ops.process.worker_concurrency}`}
    />
  );
}

export function WaitKpi({ ops }: { ops: RecognitionOps }) {
  const { wait, series } = ops.stats;
  return (
    <KpiCard
      icon={Hourglass}
      label="Queue wait (p50)"
      value={formatDuration(wait.p50_ms)}
      detail={`p95 ${formatDuration(wait.p95_ms)}`}
      spark={series.map((p) => p.wait_p50_ms)}
    />
  );
}

export function ModelLatencyKpi({ ops }: { ops: RecognitionOps }) {
  const { runs, series } = ops.stats;
  return (
    <KpiCard
      icon={Gauge}
      label="Model latency (p50)"
      value={formatDuration(runs.model_p50_ms)}
      detail={`p95 ${formatDuration(runs.model_p95_ms)} · ${ops.process.model.replace(/^google\//, "")}`}
      spark={series.map((p) => p.analysis_ms)}
    />
  );
}

export function DmKpis({ ig }: { ig: InstagramOps }) {
  const { totals, previous, reply, series } = ig.stats;
  return (
    <>
      <KpiCard
        icon={MessageCircle}
        label="DMs"
        value={formatInt(totals.messages)}
        detail={`${formatInt(totals.senders)} people · ${formatInt(totals.replied)} replied`}
        trend={trend(totals.messages, previous.messages, "up")}
        trendCaption={PREVIOUS_LABELS[ig.range]}
        spark={series.map((p) => p.messages)}
      />
      <KpiCard
        icon={Timer}
        label="DM reply time (p50)"
        value={formatDuration(reply.p50_ms)}
        detail={`p95 ${formatDuration(reply.p95_ms)}`}
        trend={trend(reply.p50_ms, previous.reply_p50_ms, "down")}
        trendCaption={PREVIOUS_LABELS[ig.range]}
        spark={series.map((p) => p.reply_p50_ms)}
      />
    </>
  );
}

/* ── Panels ──────────────────────────────────────────────────────────────── */

export function SourceMixPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const slices = ops.stats.source_mix.map((item, index) => ({
    key: item.type,
    label: SOURCE_TYPE[item.type],
    value: item.count,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]!,
  }));
  return (
    <Panel title="Source type" className={className}>
      {slices.length ? <DonutChart slices={slices} centerLabel="requests" /> : <EmptyState title="No requests yet" />}
    </Panel>
  );
}

export function ChannelMixPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const slices = ops.stats.channel_mix.map((item, index) => ({
    key: item.channel,
    label: `${CHANNEL[item.channel]} · ${formatInt(item.users)} people`,
    value: item.count,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]!,
  }));
  return (
    <Panel title="Channel" className={className}>
      {slices.length ? <DonutChart slices={slices} centerLabel="requests" /> : <EmptyState title="No requests yet" />}
    </Panel>
  );
}

/** The three ratios that say whether the pipeline is healthy. */
export function HealthGauges({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { runs, totals } = ops.stats;
  const served = runs.completed + runs.cache_hits;
  return (
    <Panel title="Health" className={className}>
      <div className="grid grid-cols-3 gap-2">
        <RadialGauge
          ratio={ratio(totals.completed, totals.requests - totals.in_progress)}
          label="Success"
          detail={`${formatInt(totals.completed)} / ${formatInt(totals.requests - totals.in_progress)}`}
          tone="success"
        />
        <RadialGauge ratio={ratio(runs.cache_hits, served)} label="Cache" detail={`${formatInt(runs.cache_hits)} / ${formatInt(served)}`} />
        <RadialGauge
          ratio={ratio(runs.places_matched, runs.places_extracted)}
          label="Match"
          detail={`${formatInt(runs.places_matched)} / ${formatInt(runs.places_extracted)}`}
        />
      </div>
    </Panel>
  );
}

export function TopPlacesPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const places = ops.stats.top_places;
  return (
    <Panel title="Top places" className={className}>
      {places.length === 0 ? (
        <EmptyState title="No places yet" />
      ) : (
        <ItemGroup className="gap-0!">
          {places.slice(0, 3).map((place, index) => (
            <Item key={place.google_place_id} role="listitem" size="sm" className="flex-nowrap px-0">
              <ItemMedia className="gap-3">
                <span className="numeric w-4 text-right text-caption font-bold text-micro">{index + 1}</span>
                <Thumb url={place.thumbnail_url} icon={MapPin} className="size-12" />
              </ItemMedia>
              <ItemContent className="min-w-0 gap-0">
                <ItemTitle className="block w-full truncate">{place.name}</ItemTitle>
                {place.rating != null && (
                  <ItemDescription className="flex items-center gap-1 tabular-nums">
                    <Star aria-hidden className="size-3.5 fill-current" />
                    {formatRating(place.rating)}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions className="numeric text-headline font-black">{formatInt(place.count)}×</ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </Panel>
  );
}

const STEPS = [
  ["fetch", "content fetched"],
  ["analysis", "media analyzed"],
  ["match", "places found"],
  ["thumbnails", "thumbnails saved"],
  ["save", "result saved"],
] as const;

export function StepsPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const avg = ops.stats.runs.steps_avg_ms;
  const items = STEPS.filter(([key]) => avg[key] != null).map(([key, step]) => ({ label: stepLabel(step), value: avg[key] ?? 0 }));
  return (
    <Panel title="Average per step" description="Fresh runs only; cache hits skip these steps" className={className}>
      {items.length ? <HorizontalBarChart items={items} valueFormatter={formatDuration} /> : <EmptyState title="No data yet" />}
    </Panel>
  );
}

export function FailuresPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { failures_by_step, top_errors } = ops.stats;
  return (
    <Panel title="Failures" className={className}>
      {failures_by_step.length === 0 ? (
        <EmptyState title="No failures" description="No attempt failed in this range." />
      ) : (
        <div className="grid gap-4">
          <HorizontalBarChart items={failures_by_step.map((f) => ({ label: stepLabel(f.step), value: f.count }))} tone="danger" />
          <ItemGroup>
            {top_errors.map((error) => (
              <Item key={`${error.step}-${error.message}`} role="listitem" variant="muted" size="sm">
                <ItemContent className="gap-0.5">
                  <ItemTitle>
                    {stepLabel(error.step)} · {formatInt(error.count)}×
                  </ItemTitle>
                  <ItemDescription>{error.message}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </div>
      )}
    </Panel>
  );
}

export function FetchMethodsPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const methods = ops.stats.fetch_methods;
  return (
    <Panel title="How content was fetched" className={className}>
      {methods.length === 0 ? (
        <EmptyState title="Nothing recorded yet" description="Fills in with new recognitions." />
      ) : (
        <HorizontalBarChart
          items={methods.map((m) => ({ label: FETCH_METHOD[m.method], value: m.count, display: `${formatInt(m.count)} · ${formatShare(m.failed, m.count)} failed` }))}
          tone="muted"
        />
      )}
    </Panel>
  );
}

export function LibraryPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { library } = ops.stats;
  return (
    <Panel title="Library and catalog" className={className}>
      <StatGrid
        className="sm:grid-cols-2"
        stats={[
          { label: "Places saved", value: formatInt(library.saved_places) },
          { label: "Lists created", value: formatInt(library.lists_created) },
          { label: "Added to lists", value: formatInt(library.list_additions) },
          { label: "Catalog places", value: formatInt(library.catalog_places) },
          { label: "New in catalog", value: formatInt(library.catalog_new) },
        ]}
      />
    </Panel>
  );
}

/** This backend instance: API traffic by route since it started. */
export function ApiHealthPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { api, memory_mb } = ops.process;
  const now = useNow();
  return (
    <Panel
      title="API health"
      description={`This process · up ${formatDuration(now - Date.parse(ops.process.started_at))} · ${formatInt(memory_mb)} MB`}
      className={className}
    >
      <div className="grid gap-4">
        <StatGrid
          className="sm:grid-cols-4"
          stats={[
            { label: "Requests", value: formatInt(api.totals.requests) },
            { label: "4xx", value: formatInt(api.totals["4xx"]) },
            { label: "5xx", value: formatInt(api.totals["5xx"]) },
            { label: "429", value: formatInt(api.totals.rate_limited) },
          ]}
        />
        {api.routes.length === 0 ? (
          <p className="text-caption text-muted-foreground">No API requests since this process started.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Errors</TableHead>
                <TableHead className="text-right">p50</TableHead>
                <TableHead className="text-right">p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {api.routes.slice(0, 8).map((route) => (
                <TableRow key={route.route}>
                  <TableCell className="max-w-56 truncate font-mono text-[13px]">{route.route}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(route.requests)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatInt(route.errors)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(route.p50_ms)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(route.p95_ms)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Panel>
  );
}
