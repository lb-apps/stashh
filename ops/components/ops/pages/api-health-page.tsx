"use client";

import { Activity, ArrowDown, ArrowUpDown, Gauge, ServerCrash, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstagramOps, useRecognitionOps } from "@/hooks/use-ops-data";
import { useNow } from "@/hooks/use-now";
import { DASH, formatDateTime, formatDuration, formatInt, formatRelative, formatShare } from "@/lib/format";
import { DEPENDENCY } from "@/lib/labels";
import type { ApiRouteHealth, RecognitionOps } from "@/lib/ops-types";
import { StackedBarChart } from "../charts/stacked-bar-chart";
import { KpiCard, KpiGrid } from "../kpi-card";
import { PageHeader } from "../page-header";
import { Panel } from "../panel";
import { KpiGridSkeleton, PanelSkeleton } from "../sections";
import { StatGrid } from "../stat-grid";
import { EmptyState, ServiceError } from "../states";

const trafficConfig = {
  ok: { label: "Succeeded", color: "var(--chart-2)" },
  client_errors: { label: "Client errors", color: "var(--amber-500)" },
  server_errors: { label: "Server errors", color: "var(--chart-5)" },
};

export function ApiHealthPage() {
  const recognitions = useRecognitionOps();
  const instagram = useInstagramOps();
  const now = useNow();
  const ops = recognitions.data;
  const api = ops?.process.api;

  return (
    <>
      <PageHeader
        title="API health"
        description={
          ops
            ? `Backend since ${formatDateTime(ops.process.started_at)} · up ${formatDuration(now - Date.parse(ops.process.started_at))} · ${formatInt(ops.process.memory_mb)} MB`
            : undefined
        }
      />
      {recognitions.error && <ServiceError error={recognitions.error} />}
      {instagram.error && <ServiceError error={instagram.error} />}

      {api ? (
        <KpiGrid>
          <KpiCard
            icon={Activity}
            label="Requests"
            value={formatInt(api.totals.requests)}
            detail={`${formatInt(api.totals["2xx"])} succeeded`}
            spark={api.series.map((p) => p.requests)}
          />
          <KpiCard
            icon={ServerCrash}
            label="Server errors"
            value={formatShare(api.totals["5xx"], api.totals.requests)}
            detail={`${formatInt(api.totals["5xx"])} server · ${formatInt(api.totals["4xx"])} client`}
            spark={api.series.map((p) => p.server_errors)}
            sparkTone="danger"
          />
          <KpiCard
            icon={ShieldAlert}
            label="Rate limited"
            value={formatInt(api.totals.rate_limited)}
            detail="Requests turned away as too many"
          />
          <KpiCard
            icon={Gauge}
            label="Typical response"
            value={formatDuration(api.latency.p50_ms)}
            detail={`Slowest 5%: ${formatDuration(api.latency.p95_ms)}`}
          />
        </KpiGrid>
      ) : (
        <KpiGridSkeleton />
      )}

      {api ? (
        <Panel title="Traffic" description="Every 5 minutes since the backend started">
          {api.totals.requests === 0 ? (
            <EmptyState title="No requests yet" description="Traffic shows up here as the app and the DM service call the API." />
          ) : (
            <StackedBarChart
              bucket="hour"
              config={trafficConfig}
              keys={["ok", "client_errors", "server_errors"] as const}
              data={api.series.map((p) => ({
                bucket: p.bucket,
                ok: Math.max(0, p.requests - p.client_errors - p.server_errors),
                client_errors: p.client_errors,
                server_errors: p.server_errors,
              }))}
            />
          )}
        </Panel>
      ) : (
        <PanelSkeleton />
      )}

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        {ops ? <DependenciesPanel ops={ops} className="lg:col-span-3" /> : <PanelSkeleton className="lg:col-span-3" />}
        {instagram.data ? (
          <Panel
            title="Instagram service"
            description={`Since ${formatDateTime(instagram.data.stats.process.started_at)}`}
            className="lg:col-span-2"
          >
            <StatGrid
              className="sm:grid-cols-2"
              stats={[
                { label: "Webhook deliveries", value: formatInt(instagram.data.stats.process.webhooks.deliveries) },
                { label: "Messages in flight", value: formatInt(instagram.data.stats.process.in_flight) },
                { label: "Messages queued", value: formatInt(instagram.data.stats.process.webhooks.messages_queued) },
                { label: "Duplicates skipped", value: formatInt(instagram.data.stats.process.webhooks.messages_duplicate) },
                { label: "Bad signatures", value: formatInt(instagram.data.stats.process.webhooks.rejected_signature) },
                { label: "Unknown payloads", value: formatInt(instagram.data.stats.process.webhooks.ignored_envelope) },
                { label: "Other accounts", value: formatInt(instagram.data.stats.process.webhooks.other_account) },
              ]}
            />
          </Panel>
        ) : (
          <PanelSkeleton className="lg:col-span-2" />
        )}
      </div>

      {api ? (
        <>
          <Panel title="Routes">
            {api.routes.length === 0 ? (
              <EmptyState title="No requests yet" />
            ) : (
              <RoutesTable routes={api.routes} now={now} />
            )}
          </Panel>
          <Panel title="Recent server errors" description="The last 25, newest first">
            {api.recent_errors.length === 0 ? (
              <EmptyState title="No server errors" description={`Nothing has failed on the server since ${formatDateTime(api.since)}.`} />
            ) : (
              <ItemGroup className="gap-2">
                {api.recent_errors.map((error) => (
                  <Item key={`${error.at}-${error.route}`} role="listitem" variant="muted" size="sm" className="px-3.5 py-3">
                    <ItemContent className="min-w-0 gap-0.5">
                      <ItemTitle className="w-full">
                        <span className="truncate font-mono text-[13px] font-medium">{error.route}</span>
                        <Badge variant="danger" className="ml-auto">
                          {error.status}
                        </Badge>
                      </ItemTitle>
                      <ItemDescription className="line-clamp-2 text-foreground">{error.message ?? "No message"}</ItemDescription>
                      <span className="micro-label">{formatRelative(error.at, now)}</span>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </Panel>
        </>
      ) : (
        <PanelSkeleton height="h-48" />
      )}
    </>
  );
}

/** Each outside service a recognition depends on: how often it held up, and how long it took. */
function DependenciesPanel({ ops, className }: { ops: RecognitionOps; className?: string }) {
  return (
    <Panel title="Dependencies" description="Fresh recognitions in the selected range; cache hits skip these" className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead className="text-right">Succeeded</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Typical time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ops.dependencies.map((dependency) => {
            const label = DEPENDENCY[dependency.key];
            const failing = dependency.failures > 0;
            return (
              <TableRow key={dependency.key}>
                <TableCell>
                  <div className="grid">
                    <span className="font-heading text-body font-semibold">{label.label}</span>
                    <span className="text-caption text-muted-foreground">{label.detail}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {dependency.attempts === 0 ? (
                    <span className="text-muted-foreground">{DASH}</span>
                  ) : (
                    <Badge variant={failing ? (dependency.failures / dependency.attempts > 0.1 ? "danger" : "warning") : "success"}>
                      {formatShare(dependency.attempts - dependency.failures, dependency.attempts)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="numeric text-right text-body font-bold">
                  {dependency.attempts === 0 ? DASH : `${formatInt(dependency.failures)} / ${formatInt(dependency.attempts)}`}
                </TableCell>
                <TableCell className="numeric text-right text-body font-bold text-muted-foreground">{formatDuration(dependency.typical_ms)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

type SortKey = "requests" | "server_errors" | "client_errors" | "p50_ms" | "p95_ms";

function SortHead({ label, column, sort, onSort }: { label: string; column: SortKey; sort: SortKey; onSort: (key: SortKey) => void }) {
  const Icon = sort === column ? ArrowDown : ArrowUpDown;
  return (
    <TableHead className="text-right">
      <Button variant="ghost" size="xs" className="micro-label -mr-2.5 hover:text-foreground" onClick={() => onSort(column)}>
        {label}
        <Icon aria-hidden />
      </Button>
    </TableHead>
  );
}

/** Every route this backend served, busiest first or by whichever column was picked. */
function RoutesTable({ routes, now }: { routes: ApiRouteHealth[]; now: number }) {
  const [sort, setSort] = useState<SortKey>("requests");
  const sorted = [...routes].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Route</TableHead>
          <SortHead label="Requests" column="requests" sort={sort} onSort={setSort} />
          <SortHead label="Client errors" column="client_errors" sort={sort} onSort={setSort} />
          <SortHead label="Server errors" column="server_errors" sort={sort} onSort={setSort} />
          <SortHead label="Typical" column="p50_ms" sort={sort} onSort={setSort} />
          <SortHead label="Slowest 5%" column="p95_ms" sort={sort} onSort={setSort} />
          <TableHead className="text-right">Last error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((route) => (
          <TableRow key={route.route}>
            <TableCell className="max-w-80 truncate font-mono text-[13px]">{route.route}</TableCell>
            <TableCell className="numeric text-right font-bold">{formatInt(route.requests)}</TableCell>
            <TableCell className="numeric text-right font-bold">{formatInt(route.client_errors)}</TableCell>
            <TableCell className={`numeric text-right font-bold ${route.server_errors > 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {route.server_errors > 0 ? (
                <Badge variant="danger" className="text-nano">
                  {formatInt(route.server_errors)}
                </Badge>
              ) : (
                "0"
              )}
            </TableCell>
            <TableCell className="numeric text-right text-muted-foreground">{formatDuration(route.p50_ms)}</TableCell>
            <TableCell className="numeric text-right text-muted-foreground">{formatDuration(route.p95_ms)}</TableCell>
            <TableCell className="text-right text-muted-foreground">{route.last_error_at ? formatRelative(route.last_error_at, now) : DASH}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
