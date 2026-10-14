"use client";

import { Activity, CircleDollarSign, Gauge, Hourglass, Inbox, MapPin, MessageCircle, Timer, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNow } from "@/hooks/use-now";
import { DASH, formatCompact, formatDuration, formatInt, formatShare, formatUsd } from "@/lib/format";
import type { InstagramStats, RecognitionStats } from "@/lib/ops-types";
import { BarList } from "./bar-list";
import { KpiCard, KpiCardSkeleton, KpiGrid } from "./kpi-card";
import { Panel } from "./panel";
import { EmptyState } from "./states";
import { stepLabel } from "./tables";

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

/** "en eski 42 sn önce" for the oldest item still waiting. */
function useAge(iso: string | null): string {
  const now = useNow();
  return iso ? formatDuration(now - Date.parse(iso)) : DASH;
}

export function QueueKpi({ live }: { live: RecognitionStats["live"] }) {
  const oldest = useAge(live.oldest_queued_at);
  return (
    <KpiCard
      icon={Inbox}
      label="Kuyrukta"
      value={formatInt(live.queued)}
      detail={live.queued > 0 ? `${formatInt(live.processing)} işleniyor · en eski ${oldest}` : `${formatInt(live.processing)} işleniyor`}
    />
  );
}

export function RecognitionKpis({ stats }: { stats: RecognitionStats }) {
  const { totals, runs } = stats;
  const served = runs.completed + runs.cache_hits;
  return (
    <>
      <QueueKpi live={stats.live} />
      <KpiCard
        icon={Activity}
        label="Tanıma isteği"
        value={formatInt(totals.requests)}
        detail={`Cache ${formatShare(runs.cache_hits, served)} · ${formatInt(totals.completed)} tamamlandı`}
      />
      <KpiCard
        icon={Timer}
        label="İşlem süresi (p50)"
        value={formatDuration(runs.processing_p50_ms)}
        detail={`p95 ${formatDuration(runs.processing_p95_ms)} · cache ${formatDuration(runs.cache_p50_ms)}`}
      />
      <KpiCard
        icon={TriangleAlert}
        label="Hata oranı"
        value={formatShare(totals.failed, totals.requests)}
        detail={`${formatInt(totals.failed)} başarısız · ${formatInt(totals.retried)} tekrar denendi`}
      />
    </>
  );
}

export function CostKpi({ runs }: { runs: RecognitionStats["runs"] }) {
  return (
    <KpiCard
      icon={CircleDollarSign}
      label="Model maliyeti"
      value={formatUsd(runs.cost_usd)}
      detail={`${formatInt(runs.model_calls)} çağrı · ${formatCompact(runs.prompt_tokens + runs.completion_tokens)} token`}
    />
  );
}

export function MatchKpi({ runs }: { runs: RecognitionStats["runs"] }) {
  return (
    <KpiCard
      icon={MapPin}
      label="Google eşleşme oranı"
      value={formatShare(runs.places_matched, runs.places_extracted)}
      detail={`${formatInt(runs.places_matched)} / ${formatInt(runs.places_extracted)} mekân`}
    />
  );
}

export function WaitKpi({ wait }: { wait: RecognitionStats["wait"] }) {
  return (
    <KpiCard icon={Hourglass} label="Kuyrukta bekleme (p50)" value={formatDuration(wait.p50_ms)} detail={`p95 ${formatDuration(wait.p95_ms)}`} />
  );
}

export function DmKpis({ stats }: { stats: InstagramStats }) {
  const { totals, reply } = stats;
  return (
    <>
      <KpiCard
        icon={MessageCircle}
        label="DM"
        value={formatInt(totals.messages)}
        detail={`${formatInt(totals.senders)} kişi · ${formatInt(totals.replied)} yanıtlandı`}
      />
      <KpiCard icon={Gauge} label="DM yanıt süresi (p50)" value={formatDuration(reply.p50_ms)} detail={`p95 ${formatDuration(reply.p95_ms)}`} />
    </>
  );
}

const STEPS = [
  ["fetch", "content fetched"],
  ["analysis", "media analyzed"],
  ["match", "places found"],
  ["thumbnails", "thumbnails saved"],
  ["save", "result saved"],
] as const;

/** Average time per pipeline step on fresh runs: shows where the seconds go. */
export function StepsPanel({ runs, className }: { runs: RecognitionStats["runs"]; className?: string }) {
  const items = STEPS.filter(([key]) => runs.steps_avg_ms[key] != null).map(([key, step]) => ({
    label: stepLabel(step),
    value: runs.steps_avg_ms[key] ?? 0,
    display: formatDuration(runs.steps_avg_ms[key]),
    tone: key === "analysis" ? ("primary" as const) : ("muted" as const),
  }));
  return (
    <Panel title="Adım başına ortalama" description="Yeni işlenen tanımalarda" className={className}>
      {items.length > 0 ? <BarList items={items} /> : <EmptyState title="Henüz veri yok" description="İlk yeni işlemden sonra dolacak." />}
    </Panel>
  );
}

export function FailuresByStepPanel({ failures, className }: { failures: RecognitionStats["failures_by_step"]; className?: string }) {
  return (
    <Panel title="Hatalar adıma göre" description="Başarısız denemelerin durduğu yer" className={className}>
      {failures.length > 0 ? (
        <BarList items={failures.map((failure) => ({ label: stepLabel(failure.step), value: failure.count, tone: "danger" }))} />
      ) : (
        <EmptyState title="Hata yok" description="Bu aralıkta başarısız deneme olmadı." />
      )}
    </Panel>
  );
}
