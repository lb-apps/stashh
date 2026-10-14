"use client";

import { useInstagramOps, useRecognitionOps } from "@/hooks/use-ops-data";
import { RANGE_LABELS } from "@/lib/ops-types";
import { MessagesChart, RequestsChart } from "../charts";
import { KpiGrid } from "../kpi-card";
import { Panel } from "../panel";
import { CostKpi, DmKpis, KpiGridSkeleton, MatchKpi, PanelSkeleton, RecognitionKpis, StepsPanel } from "../sections";
import { ServiceError } from "../states";
import { QueueTable } from "../tables";

export function OverviewPage() {
  const recognitions = useRecognitionOps();
  const instagram = useInstagramOps();

  return (
    <>
      {recognitions.error && <ServiceError error={recognitions.error} />}
      {instagram.error && <ServiceError error={instagram.error} />}

      {recognitions.data ? (
        <KpiGrid>
          <RecognitionKpis stats={recognitions.data.stats} />
          <CostKpi runs={recognitions.data.stats.runs} />
          <MatchKpi runs={recognitions.data.stats.runs} />
          {instagram.data && <DmKpis stats={instagram.data.stats} />}
        </KpiGrid>
      ) : (
        <KpiGridSkeleton count={8} />
      )}

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        {recognitions.data ? (
          <>
            <Panel title="Tanıma istekleri" description={`Son ${RANGE_LABELS[recognitions.data.range]}`} className="lg:col-span-2">
              <RequestsChart series={recognitions.data.stats.series} bucket={recognitions.data.bucket} />
            </Panel>
            <StepsPanel runs={recognitions.data.stats.runs} />
          </>
        ) : (
          <>
            <PanelSkeleton className="lg:col-span-2" />
            <PanelSkeleton />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {recognitions.data ? (
          <Panel title="Canlı kuyruk" description="Bekleyen ve işlenen tanımalar">
            <QueueTable items={recognitions.data.queue} />
          </Panel>
        ) : (
          <PanelSkeleton height="h-40" />
        )}
        {instagram.data ? (
          <Panel title="Instagram DM" description={`Son ${RANGE_LABELS[instagram.data.range]}`}>
            <MessagesChart series={instagram.data.stats.series} bucket={instagram.data.bucket} />
          </Panel>
        ) : (
          <PanelSkeleton />
        )}
      </div>
    </>
  );
}
