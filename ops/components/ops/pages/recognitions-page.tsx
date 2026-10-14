"use client";

import { useRecognitionOps } from "@/hooks/use-ops-data";
import { useOpenDetail } from "@/hooks/use-detail-param";
import { formatDuration } from "@/lib/format";
import { RANGE_LABELS } from "@/lib/ops-types";
import { useOpsControls } from "../ops-provider";
import { MultiLineChart } from "../charts/multi-line-chart";
import { STEP_COLORS } from "../charts/shared";
import { StackedBarChart } from "../charts/stacked-bar-chart";
import { KpiGrid } from "../kpi-card";
import { PageHeader } from "../page-header";
import { Panel } from "../panel";
import { RunsWithDetail } from "../detail-from-url";
import { RecognitionsBrowser } from "../recognitions-browser";
import {
  CostKpi,
  FailuresPanel,
  FetchMethodsPanel,
  KpiGridSkeleton,
  ModelLatencyKpi,
  PanelSkeleton,
  QueueKpi,
  StepsPanel,
  WaitKpi,
} from "../sections";
import { ServiceError } from "../states";
import { QueueTable } from "../tables";

const durationConfig = {
  processing_p50_ms: { label: "Processing p50", color: "var(--chart-1)" },
  processing_p95_ms: { label: "Processing p95", color: "var(--chart-2)" },
  wait_p50_ms: { label: "Queue wait p50", color: "var(--amber-500)" },
};

const stepsConfig = {
  fetch_ms: { label: "Content fetch", color: STEP_COLORS.fetch },
  analysis_ms: { label: "Model", color: STEP_COLORS.analysis },
  match_ms: { label: "Google match", color: STEP_COLORS.match },
  thumbnails_ms: { label: "Photos", color: STEP_COLORS.thumbnails },
};

export function RecognitionsPage() {
  const { data: ops, error } = useRecognitionOps();
  const openDetail = useOpenDetail();
  const { range } = useOpsControls();

  return (
    <>
      <PageHeader
        title="Recognition runs"
        description={`Last ${RANGE_LABELS[range]}. Open a run to see every step and what it found.`}
      />
      {error && <ServiceError error={error} />}
      {ops ? (
        <KpiGrid>
          <QueueKpi ops={ops} />
          <WaitKpi ops={ops} />
          <ModelLatencyKpi ops={ops} />
          <CostKpi ops={ops} />
        </KpiGrid>
      ) : (
        <KpiGridSkeleton />
      )}

      {ops ? (
        <RunsWithDetail>
          {(selectedId) => <RecognitionsBrowser items={ops.recognitions} onOpen={openDetail} selectedId={selectedId} />}
        </RunsWithDetail>
      ) : (
        <PanelSkeleton height="h-96" />
      )}

      {ops && ops.queue.length > 0 && (
        <Panel title="Live queue" description="Recognitions waiting or running; times tick live">
          <QueueTable items={ops.queue} onOpen={openDetail} />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {ops ? (
          <>
            <Panel title="Durations" description={`Processing and queue time · last ${RANGE_LABELS[ops.range]}`}>
              <MultiLineChart
                bucket={ops.bucket}
                config={durationConfig}
                keys={["processing_p50_ms", "processing_p95_ms", "wait_p50_ms"] as const}
                data={ops.stats.series}
                valueFormatter={formatDuration}
                axisFormatter={formatDuration}
              />
            </Panel>
            <Panel title="Where the time goes" description="Average time per step in fresh runs">
              <StackedBarChart
                bucket={ops.bucket}
                config={stepsConfig}
                keys={["fetch_ms", "analysis_ms", "match_ms", "thumbnails_ms"] as const}
                data={ops.stats.series}
                valueFormatter={formatDuration}
                axisFormatter={formatDuration}
              />
            </Panel>
          </>
        ) : (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {ops ? (
          <>
            <StepsPanel ops={ops} />
            <FailuresPanel ops={ops} />
            <FetchMethodsPanel ops={ops} />
          </>
        ) : (
          <>
            <PanelSkeleton />
            <PanelSkeleton />
            <PanelSkeleton />
          </>
        )}
      </div>

    </>
  );
}
