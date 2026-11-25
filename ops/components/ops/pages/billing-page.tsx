"use client";

import { Ban, CalendarCheck, Coins, Crown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBillingOps } from "@/hooks/use-ops-data";
import type { BillingOps, CreditMovement } from "@/lib/billing-types";
import { formatDateTime, formatInt, formatShare, formatSignedInt } from "@/lib/format";
import { creditReasonLabel, personLabel } from "@/lib/labels";
import { BillingPeople } from "../billing-people";
import { BillingSettingsPanel } from "../billing-settings";
import { HorizontalBarChart } from "../charts/horizontal-bar-chart";
import { StackedBarChart } from "../charts/stacked-bar-chart";
import { KpiCard, KpiGrid } from "../kpi-card";
import { PageHeader } from "../page-header";
import { Panel } from "../panel";
import { KpiGridSkeleton, PanelSkeleton } from "../sections";
import { StatGrid } from "../stat-grid";
import { EmptyState, ServiceError } from "../states";

const analysesConfig = {
  allowance: { label: "Paid by allowance", color: "var(--chart-1)" },
  credit: { label: "Paid with a credit", color: "var(--chart-2)" },
  refusals: { label: "Refused", color: "var(--chart-4)" },
};

export function BillingPage() {
  const { data: ops, error } = useBillingOps();

  return (
    <>
      <PageHeader title="Billing" description="An analysis is a share that found a place; the plan's daily allowance or one credit pays for it." />
      {error && <ServiceError error={error} />}
      {ops ? (
        <Numbers ops={ops} />
      ) : (
        <>
          <KpiGridSkeleton count={4} />
          <PanelSkeleton />
        </>
      )}

      {/* The tools work whether or not the numbers loaded. */}
      <div className="grid items-start gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="People" description="Change someone's credits or plan" className="lg:col-span-2">
          <BillingPeople />
        </Panel>
        <Panel title="Settings" description="Applied on the next analysis; no deploy needed">
          <BillingSettingsPanel />
        </Panel>
      </div>

      {ops && (
        <Panel title="Latest credit movements" description="The newest 50, whatever the range">
          <LedgerTable movements={ops.ledger} />
        </Panel>
      )}
    </>
  );
}

function Numbers({ ops }: { ops: BillingOps }) {
  const { totals, series, earned_by } = ops.stats;
  const paid = totals.analyses_allowance + totals.analyses_credit;

  return (
    <>
      <KpiGrid>
        <KpiCard icon={Crown} label="Premium people" value={formatInt(totals.premium_people)} detail="Right now, whatever the range" />
        <KpiCard
          icon={CalendarCheck}
          label="Paid by allowance"
          value={formatInt(totals.analyses_allowance)}
          detail={paid ? `${formatShare(totals.analyses_allowance, paid)} of analyses` : "No analyses in this range"}
          spark={series.map((p) => p.allowance)}
        />
        <KpiCard
          icon={Coins}
          label="Paid with credits"
          value={formatInt(totals.analyses_credit)}
          detail={paid ? `${formatShare(totals.analyses_credit, paid)} of analyses` : "No analyses in this range"}
          spark={series.map((p) => p.credit)}
        />
        <KpiCard
          icon={Ban}
          label="Refused"
          value={formatInt(totals.refusals)}
          detail={`${formatInt(totals.people_refused)} ${totals.people_refused === 1 ? "person" : "people"} ran out`}
          spark={series.map((p) => p.refusals)}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Analyses" className="lg:col-span-2">
          <StackedBarChart bucket={ops.bucket} config={analysesConfig} keys={["allowance", "credit", "refusals"] as const} data={series} />
        </Panel>
        <Panel title="Credits">
          <div className="grid gap-5">
            <StatGrid
              size="md"
              className="grid-cols-2 sm:grid-cols-2"
              stats={[
                { label: "Earned", value: formatInt(totals.credits_earned) },
                { label: "Held now", value: formatInt(totals.credits_held) },
              ]}
            />
            {earned_by.length > 0 && (
              <div className="grid gap-2">
                <span className="micro-label">Earned from</span>
                <HorizontalBarChart tone="muted" items={earned_by.map((source) => ({ label: creditReasonLabel(source.reason, source.ref), value: source.credits }))} />
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

function LedgerTable({ movements }: { movements: CreditMovement[] }) {
  if (movements.length === 0) {
    return <EmptyState title="No credit movements yet" description="Task rewards, analyses paid with a credit, and the changes you make above." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>For</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead className="text-right">Balance after</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => (
          <TableRow key={movement.id}>
            <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(movement.created_at)}</TableCell>
            <TableCell className="max-w-56 truncate">{personLabel(movement.username, movement.user_id)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {movement.reason === "recognition" ? (
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link href={`/recognitions?id=${encodeURIComponent(movement.ref)}`}>{creditReasonLabel(movement.reason, movement.ref)}</Link>
                </Button>
              ) : (
                creditReasonLabel(movement.reason, movement.ref)
              )}
            </TableCell>
            <TableCell className="numeric text-right font-bold">{formatSignedInt(movement.delta)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatInt(movement.balance_after)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
