"use client";

import { useRecognitionOps } from "@/hooks/use-ops-data";
import { RANGE_LABELS } from "@/lib/ops-types";
import { RequestsChart } from "../charts";
import { KpiGrid } from "../kpi-card";
import { Panel } from "../panel";
import { CostKpi, FailuresByStepPanel, KpiGridSkeleton, MatchKpi, PanelSkeleton, QueueKpi, StepsPanel, WaitKpi } from "../sections";
import { ServiceError } from "../states";
import { QueueTable, RunsTable } from "../tables";

export function RecognitionsPage() {
  const { data, error } = useRecognitionOps();

  if (!data) {
    return (
      <>
        {error && <ServiceError error={error} />}
        <KpiGridSkeleton />
        <PanelSkeleton height="h-40" />
        <PanelSkeleton height="h-96" />
      </>
    );
  }

  const { stats } = data;
  return (
    <>
      {error && <ServiceError error={error} />}
      <KpiGrid>
        <QueueKpi live={stats.live} />
        <WaitKpi wait={stats.wait} />
        <CostKpi runs={stats.runs} />
        <MatchKpi runs={stats.runs} />
      </KpiGrid>

      <Panel title="Canlı kuyruk" description="Bekleyen ve işlenen tanımalar; süreler canlı akar">
        <QueueTable items={data.queue} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="İstekler" description={`Son ${RANGE_LABELS[data.range]}`} className="lg:col-span-2">
          <RequestsChart series={stats.series} bucket={data.bucket} />
        </Panel>
        <div className="grid gap-4 lg:gap-6">
          <StepsPanel runs={stats.runs} />
          <FailuresByStepPanel failures={stats.failures_by_step} />
        </div>
      </div>

      <Panel title="Son çalışmalar" description="Worker'ın son 50 denemesi; hataların üzerine gelince mesajı görünür">
        <RunsTable runs={data.recent_runs} />
      </Panel>
    </>
  );
}
