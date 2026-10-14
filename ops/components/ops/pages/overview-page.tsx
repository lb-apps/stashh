"use client";

import { useInstagramOps, useRecognitionOps } from "@/hooks/use-ops-data";
import { useDetailHref, useOpenDetail } from "@/hooks/use-detail-param";
import { useNow } from "@/hooks/use-now";
import { formatCompact, formatDuration, formatInt, formatUsd } from "@/lib/format";
import { InteractiveBarChart } from "../charts/interactive-bar-chart";
import { StackedAreaChart } from "../charts/stacked-area-chart";
import { KpiGrid } from "../kpi-card";
import { PageHeader } from "../page-header";
import { Panel } from "../panel";
import { RecognitionDetailFromUrl } from "../detail-from-url";
import { RecognitionGallery } from "../recognitions-browser";
import {
  ApiHealthPanel,
  ChannelMixPanel,
  CostKpi,
  DmKpis,
  FailureKpi,
  HealthGauges,
  KpiGridSkeleton,
  LibraryPanel,
  PanelSkeleton,
  ProcessingKpi,
  RequestsKpi,
  SourceMixPanel,
  TopPlacesPanel,
  UsersKpi,
  ZeroResultKpi,
} from "../sections";
import { ServiceError } from "../states";
import { QueueTable } from "../tables";

const outcomeConfig = {
  fresh: { label: "Fresh run", color: "var(--chart-1)" },
  cache: { label: "Cache", color: "var(--chart-2)" },
  failed: { label: "Failed", color: "var(--chart-5)" },
};

export function OverviewPage() {
  const recognitions = useRecognitionOps();
  const instagram = useInstagramOps();
  const openDetail = useOpenDetail();
  const detailHref = useDetailHref();
  const now = useNow();
  const ops = recognitions.data;

  return (
    <>
      <PageHeader title="Overview" />
      {recognitions.error && <ServiceError error={recognitions.error} />}
      {instagram.error && <ServiceError error={instagram.error} />}

      {ops ? (
        <KpiGrid>
          <RequestsKpi ops={ops} />
          <ProcessingKpi ops={ops} />
          <FailureKpi ops={ops} />
          <CostKpi ops={ops} />
          <UsersKpi ops={ops} />
          <ZeroResultKpi ops={ops} />
          {instagram.data && <DmKpis ig={instagram.data} />}
        </KpiGrid>
      ) : (
        <KpiGridSkeleton count={8} />
      )}

      {ops ? (
        <InteractiveBarChart
          title="Over time"
          bucket={ops.bucket}
          data={ops.stats.series.map((p) => ({
            bucket: p.bucket,
            requests: p.requests,
            cost_usd: p.cost_usd,
            processing_p50_ms: p.processing_p50_ms,
            tokens: p.tokens,
          }))}
          metrics={[
            { key: "requests", label: "Requests", total: formatInt(ops.stats.totals.requests), format: formatInt },
            { key: "cost_usd", label: "Cost", total: formatUsd(ops.stats.runs.cost_usd), format: formatUsd },
            { key: "processing_p50_ms", label: "Duration p50", total: formatDuration(ops.stats.runs.processing_p50_ms), format: formatDuration },
            {
              key: "tokens",
              label: "Tokens",
              total: formatCompact(ops.stats.runs.prompt_tokens + ops.stats.runs.completion_tokens),
              format: formatCompact,
            },
          ]}
        />
      ) : (
        <PanelSkeleton height="h-72" />
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {ops ? (
          <>
            <Panel title="Outcomes" className="lg:col-span-2">
              <StackedAreaChart
                bucket={ops.bucket}
                config={outcomeConfig}
                keys={["fresh", "cache", "failed"] as const}
                data={ops.stats.series.map((p) => ({
                  bucket: p.bucket,
                  fresh: Math.max(0, p.completed - p.cache_hits),
                  cache: p.cache_hits,
                  failed: p.failed,
                }))}
              />
            </Panel>
            <HealthGauges ops={ops} />
          </>
        ) : (
          <>
            <PanelSkeleton className="lg:col-span-2" />
            <PanelSkeleton />
          </>
        )}
      </div>

      {ops && (
        <Panel title="Latest recognitions">
          <RecognitionGallery items={ops.recognitions.slice(0, 10)} href={detailHref} now={now} />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {ops ? (
          <>
            <SourceMixPanel ops={ops} />
            <ChannelMixPanel ops={ops} />
            <TopPlacesPanel ops={ops} />
          </>
        ) : (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {ops ? (
          <>
            <Panel title="Live queue" className="lg:col-span-2">
              <QueueTable items={ops.queue} onOpen={openDetail} />
            </Panel>
            <LibraryPanel ops={ops} />
            <ApiHealthPanel ops={ops} className="lg:col-span-3" />
          </>
        ) : (
          <PanelSkeleton className="lg:col-span-3" height="h-40" />
        )}
      </div>

      <RecognitionDetailFromUrl />
    </>
  );
}
