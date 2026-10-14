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
import Image from "next/image";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { DASH, formatCompact, formatDuration, formatInt, formatShare, formatUsd } from "@/lib/format";
import { CHANNEL, FETCH_METHOD, SOURCE_TYPE, stepLabel } from "@/lib/labels";
import { PREVIOUS_LABELS, type InstagramOps, type RecognitionOps } from "@/lib/ops-types";
import { trend } from "@/lib/trend";
import { DonutChart } from "./charts/donut-chart";
import { HorizontalBarChart } from "./charts/horizontal-bar-chart";
import { RadialGauge } from "./charts/radial-gauge";
import { KpiCard, KpiCardSkeleton, KpiGrid } from "./kpi-card";
import { Panel } from "./panel";
import { EmptyState } from "./states";

const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);
const SOURCE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

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
    <Panel title="Yükleniyor" className={className}>
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
      label="Tanıma isteği"
      value={formatInt(totals.requests)}
      detail={`Cache ${formatShare(runs.cache_hits, runs.cache_hits + runs.completed)} · ${formatInt(totals.unique_sources)} farklı kaynak`}
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
      label="İşlem süresi (p50)"
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
      label="Hata oranı"
      value={formatShare(totals.failed, totals.requests)}
      detail={`${formatInt(totals.failed)} başarısız · ${formatInt(totals.retried)} tekrar denendi`}
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
      label="Model maliyeti"
      value={formatUsd(runs.cost_usd)}
      detail={`${formatInt(runs.model_calls)} çağrı · ${formatCompact(runs.prompt_tokens + runs.completion_tokens)} token · tanıma başı ${formatUsd(perRun)}`}
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
      label="Aktif kullanıcı"
      value={formatInt(totals.active_users)}
      detail={`Toplam ${formatInt(users.total)} · ${formatInt(users.new)} yeni (${formatInt(users.new_instagram)} Instagram)`}
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
      label="Sıfır sonuç oranı"
      value={formatShare(runs.zero_results, runs.completed)}
      detail={`${formatInt(runs.zero_results)} tanımada mekân yok · ort. ${runs.completed ? (runs.places_extracted / runs.completed).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : DASH} mekân`}
      trend={trend(ratio(runs.zero_results, runs.completed), ratio(previous.zero_results, previous.completed_runs), "down")}
      trendCaption={PREVIOUS_LABELS[ops.range]}
    />
  );
}

/** "en eski 42 sn" for the oldest item still waiting. */
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
      label="Kuyrukta"
      value={formatInt(live.queued)}
      detail={live.queued > 0 ? `${formatInt(live.processing)} işleniyor · en eski ${oldest}` : `${formatInt(live.processing)} işleniyor · worker ×${ops.process.worker_concurrency}`}
    />
  );
}

export function WaitKpi({ ops }: { ops: RecognitionOps }) {
  const { wait, series } = ops.stats;
  return (
    <KpiCard
      icon={Hourglass}
      label="Kuyrukta bekleme (p50)"
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
      label="Model gecikmesi (p50)"
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
        label="DM"
        value={formatInt(totals.messages)}
        detail={`${formatInt(totals.senders)} kişi · ${formatInt(totals.replied)} yanıtlandı`}
        trend={trend(totals.messages, previous.messages, "up")}
        trendCaption={PREVIOUS_LABELS[ig.range]}
        spark={series.map((p) => p.messages)}
      />
      <KpiCard
        icon={Timer}
        label="DM yanıt süresi (p50)"
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
    color: SOURCE_COLORS[index % SOURCE_COLORS.length]!,
  }));
  return (
    <Panel title="Kaynak türü" description="Ne paylaşıldı" className={className}>
      {slices.length ? <DonutChart slices={slices} centerLabel="istek" /> : <EmptyState title="Henüz istek yok" />}
    </Panel>
  );
}

export function ChannelMixPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const slices = ops.stats.channel_mix.map((item, index) => ({
    key: item.channel,
    label: `${CHANNEL[item.channel]} · ${formatInt(item.users)} kişi`,
    value: item.count,
    color: SOURCE_COLORS[index % SOURCE_COLORS.length]!,
  }));
  return (
    <Panel title="Kanal" description="İsteklerin geldiği yer" className={className}>
      {slices.length ? <DonutChart slices={slices} centerLabel="istek" /> : <EmptyState title="Henüz istek yok" />}
    </Panel>
  );
}

/** The three ratios that say whether the pipeline is healthy. */
export function HealthGauges({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { runs, totals } = ops.stats;
  const served = runs.completed + runs.cache_hits;
  return (
    <Panel title="Sağlık" description="Başarı, cache ve Google eşleşme oranları" className={className}>
      <div className="grid grid-cols-3 gap-2">
        <RadialGauge
          ratio={ratio(totals.completed, totals.requests - totals.in_progress)}
          label="Başarı"
          detail={`${formatInt(totals.completed)} / ${formatInt(totals.requests - totals.in_progress)}`}
          tone="success"
        />
        <RadialGauge ratio={ratio(runs.cache_hits, served)} label="Cache" detail={`${formatInt(runs.cache_hits)} / ${formatInt(served)}`} />
        <RadialGauge
          ratio={ratio(runs.places_matched, runs.places_extracted)}
          label="Eşleşme"
          detail={`${formatInt(runs.places_matched)} / ${formatInt(runs.places_extracted)}`}
        />
      </div>
    </Panel>
  );
}

export function TopPlacesPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const places = ops.stats.top_places;
  return (
    <Panel title="En çok çıkan mekânlar" description="Bu aralıkta tanımalarda" className={className}>
      {places.length === 0 ? (
        <EmptyState title="Henüz mekân yok" />
      ) : (
        <ol className="grid gap-2">
          {places.map((place, index) => (
            <li key={place.google_place_id} className="flex items-center gap-3">
              <span className="w-4 text-right text-xs text-muted-foreground tabular-nums">{index + 1}</span>
              <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                {place.thumbnail_url && <Image src={place.thumbnail_url} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <div className="grid min-w-0 flex-1">
                <span className="truncate text-sm font-medium">{place.name}</span>
                {place.rating != null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    <Star aria-hidden className="size-3 fill-current" />
                    {place.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1 })}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium tabular-nums">{formatInt(place.count)}×</span>
            </li>
          ))}
        </ol>
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
    <Panel title="Adım başına ortalama" description="Yeni işlenen tanımalarda zaman nereye gidiyor" className={className}>
      {items.length ? <HorizontalBarChart items={items} valueFormatter={formatDuration} /> : <EmptyState title="Henüz veri yok" />}
    </Panel>
  );
}

export function FailuresPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { failures_by_step, top_errors } = ops.stats;
  return (
    <Panel title="Hatalar" description="Başarısız denemelerin durduğu adım ve en sık mesajlar" className={className}>
      {failures_by_step.length === 0 ? (
        <EmptyState title="Hata yok" description="Bu aralıkta başarısız deneme olmadı." />
      ) : (
        <div className="grid gap-4">
          <HorizontalBarChart items={failures_by_step.map((f) => ({ label: stepLabel(f.step), value: f.count }))} tone="danger" />
          <ul className="grid gap-2">
            {top_errors.map((error) => (
              <li key={`${error.step}-${error.message}`} className="grid gap-0.5 rounded-lg bg-muted px-3 py-2 text-xs">
                <span className="font-medium">
                  {stepLabel(error.step)} · {formatInt(error.count)}×
                </span>
                <span className="line-clamp-2 text-muted-foreground">{error.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function FetchMethodsPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const methods = ops.stats.fetch_methods;
  return (
    <Panel title="İçerik nasıl alındı" description="Kaynağa erişim yolları ve başarısızlıkları" className={className}>
      {methods.length === 0 ? (
        <EmptyState title="Henüz kayıt yok" description="Yeni tanımalarla dolacak." />
      ) : (
        <HorizontalBarChart
          items={methods.map((m) => ({ label: FETCH_METHOD[m.method], value: m.count, display: `${formatInt(m.count)} · ${formatShare(m.failed, m.count)} hata` }))}
          tone="muted"
        />
      )}
    </Panel>
  );
}

export function LibraryPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { library } = ops.stats;
  const rows = [
    ["Kaydedilen mekân", library.saved_places],
    ["Oluşturulan liste", library.lists_created],
    ["Listeye ekleme", library.list_additions],
    ["Katalogdaki mekân", library.catalog_places],
    ["Kataloğa yeni eklenen", library.catalog_new],
  ] as const;
  return (
    <Panel title="Kütüphane ve katalog" description="Kullanıcıların kaydettikleri, mekân kataloğu" className={className}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-heading text-xl font-semibold tabular-nums">{formatInt(value)}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** This backend instance: API traffic by route since it started. */
export function ApiHealthPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  const { api, memory_mb } = ops.process;
  const now = useNow();
  return (
    <Panel
      title="API sağlığı"
      description={`Bu süreç · ${formatDuration(now - Date.parse(ops.process.started_at))} çalışıyor · ${formatInt(memory_mb)} MB`}
      className={className}
    >
      <div className="grid gap-4">
        <dl className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              ["İstek", api.totals.requests],
              ["4xx", api.totals["4xx"]],
              ["5xx", api.totals["5xx"]],
              ["429", api.totals.rate_limited],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg bg-muted py-2">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-heading text-lg font-semibold tabular-nums">{formatInt(value)}</dd>
            </div>
          ))}
        </dl>
        {api.routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu süreç başladığından beri API isteği gelmedi.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className="text-right">İstek</TableHead>
                <TableHead className="text-right">Hata</TableHead>
                <TableHead className="text-right">p50</TableHead>
                <TableHead className="text-right">p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {api.routes.slice(0, 8).map((route) => (
                <TableRow key={route.route}>
                  <TableCell className="max-w-56 truncate font-mono text-xs">{route.route}</TableCell>
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
