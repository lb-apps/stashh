"use client";

import { Coins, MessagesSquare, Timer, TriangleAlert, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDetailHref, useOpenDetail } from "@/hooks/use-detail-param";
import { useAssistantOps } from "@/hooks/use-ops-data";
import { DASH, formatDateTime, formatDuration, formatInt, formatShare, formatUsd } from "@/lib/format";
import { ASSISTANT_STATUS, toolLabel } from "@/lib/labels";
import { PREVIOUS_LABELS, type AssistantTurnSummary } from "@/lib/ops-types";
import { trend } from "@/lib/trend";
import { AssistantSettingsPanel } from "../assistant-settings";
import { AssistantTurnFromUrl } from "../assistant-turn-detail";
import { HorizontalBarChart } from "../charts/horizontal-bar-chart";
import { MultiLineChart } from "../charts/multi-line-chart";
import { StackedAreaChart } from "../charts/stacked-area-chart";
import { KpiCard, KpiGrid } from "../kpi-card";
import { PageHeader } from "../page-header";
import { Panel } from "../panel";
import { KpiGridSkeleton, PanelSkeleton } from "../sections";
import { EmptyState, ServiceError } from "../states";

const turnsConfig = {
  replied: { label: "Replied", color: "var(--chart-1)" },
  fallback: { label: "Fixed line", color: "var(--chart-4)" },
  capped: { label: "Daily cap", color: "var(--chart-3)" },
  failed: { label: "Failed", color: "var(--chart-5)" },
};
const costConfig = { cost_usd: { label: "Cost", color: "var(--chart-1)" } };

export function AssistantPage() {
  const { data: ops, error } = useAssistantOps();
  const header = <PageHeader title="Assistant" description="The DM assistant: what it answered, what it cost, and how it is set." />;

  if (!ops) {
    return (
      <>
        {header}
        {error && <ServiceError error={error} />}
        <KpiGridSkeleton count={5} />
        <PanelSkeleton />
      </>
    );
  }

  const { totals, previous, series, tools } = ops.stats;
  const notAnswered = totals.fallback + totals.failed;
  const cacheShare = totals.prompt_tokens ? totals.cached_tokens / totals.prompt_tokens : null;

  return (
    <>
      {header}
      {error && <ServiceError error={error} />}
      <KpiGrid>
        <KpiCard
          icon={MessagesSquare}
          label="Turns"
          value={formatInt(totals.turns)}
          detail={`${formatInt(totals.senders)} people · ${totals.steps_avg == null ? DASH : totals.steps_avg.toFixed(1)} model calls each`}
          trend={trend(totals.turns, previous.turns, "up")}
          trendCaption={PREVIOUS_LABELS[ops.range]}
          spark={series.map((p) => p.replied + p.fallback + p.capped + p.failed)}
        />
        <KpiCard
          icon={Coins}
          label="Cost"
          value={formatUsd(totals.cost_usd)}
          detail={totals.turns ? `${formatUsd(totals.cost_usd / totals.turns)} per turn` : "No turns yet"}
          trend={trend(totals.cost_usd, previous.cost_usd, "down")}
          trendCaption={PREVIOUS_LABELS[ops.range]}
          spark={series.map((p) => p.cost_usd)}
        />
        <KpiCard icon={Timer} label="Typical turn" value={formatDuration(totals.typical_ms)} detail={`Slowest 5 %: ${formatDuration(totals.slow_ms)}`} />
        <KpiCard
          icon={Zap}
          label="From cache"
          value={cacheShare == null ? DASH : formatShare(totals.cached_tokens, totals.prompt_tokens)}
          detail={`${formatInt(totals.prompt_tokens)} in · ${formatInt(totals.completion_tokens)} out tokens`}
          badge={cacheShare != null && cacheShare < 0.5 && totals.turns > 3 ? <Badge variant="warning">Low</Badge> : undefined}
        />
        <KpiCard
          icon={TriangleAlert}
          label="Not answered"
          value={formatShare(notAnswered, totals.turns)}
          detail={`${formatInt(totals.fallback)} fixed lines · ${formatInt(totals.failed)} failed · ${formatInt(totals.capped)} capped`}
          trend={trend(totals.turns ? totals.failed / totals.turns : null, previous.turns ? previous.failed / previous.turns : null, "down")}
          trendCaption={PREVIOUS_LABELS[ops.range]}
          spark={series.map((p) => p.failed)}
          sparkTone="danger"
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Turns" className="lg:col-span-2">
          <StackedAreaChart bucket={ops.bucket} config={turnsConfig} keys={["replied", "fallback", "capped", "failed"] as const} data={series} />
        </Panel>
        <Panel title="Tools used">
          {tools.length === 0 ? (
            <EmptyState title="No tool calls yet" description="Answers from the account block alone need none." />
          ) : (
            <HorizontalBarChart tone="muted" items={tools.map((tool) => ({ label: toolLabel(tool.name), value: tool.uses }))} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Cost" description="What the model billed per bucket">
          <MultiLineChart bucket={ops.bucket} config={costConfig} keys={["cost_usd"] as const} data={series} valueFormatter={formatUsd} axisFormatter={formatUsd} />
        </Panel>
        <Panel title="Latest turns" description="Newest first; open one for the whole thread" className="lg:col-span-2">
          <AssistantTurnFromUrl>{(selectedId) => <TurnsTable turns={ops.turns} selectedId={selectedId} />}</AssistantTurnFromUrl>
        </Panel>
      </div>

      <Panel title="Settings" description="Applied on the next turn; no deploy needed">
        <AssistantSettingsPanel />
      </Panel>
    </>
  );
}

function TurnsTable({ turns, selectedId }: { turns: AssistantTurnSummary[]; selectedId: string | null }) {
  const open = useOpenDetail();
  const href = useDetailHref();
  if (turns.length === 0) return <EmptyState title="No turns yet" description="The first typed DM shows up here." />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>Asked</TableHead>
          <TableHead>Answered</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Time</TableHead>
          <TableHead className="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {turns.map((turn) => {
          const status = ASSISTANT_STATUS[turn.status];
          const selected = turn.id === selectedId;
          return (
            <TableRow
              key={turn.id}
              className="cursor-pointer"
              data-state={selected ? "selected" : undefined}
              tabIndex={0}
              aria-label={`Open the turn with ${turn.username ? `@${turn.username}` : "someone"} at ${formatDateTime(turn.created_at)}`}
              onClick={() => open(turn.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  open(turn.id);
                }
              }}
            >
              <TableCell className="whitespace-nowrap tabular-nums">
                <a href={href(turn.id)} className="hover:text-primary" onClick={(event) => event.preventDefault()} tabIndex={-1}>
                  {formatDateTime(turn.created_at)}
                </a>
              </TableCell>
              <TableCell className="whitespace-nowrap">{turn.username ? `@${turn.username}` : DASH}</TableCell>
              <TableCell className="max-w-56 truncate">{turn.question ?? DASH}</TableCell>
              <TableCell className="max-w-72 truncate text-muted-foreground">{turn.status === "failed" ? (turn.error ?? DASH) : (turn.answer ?? DASH)}</TableCell>
              <TableCell>
                <Badge variant={status.variant}>{status.label}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatDuration(turn.duration_ms)}</TableCell>
              <TableCell className="text-right tabular-nums">{turn.cost_usd == null ? DASH : formatUsd(turn.cost_usd)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
