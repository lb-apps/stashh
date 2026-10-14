"use client";

import { CalendarClock, Inbox, TriangleAlert, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInstagramOps } from "@/hooks/use-ops-data";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatDuration, formatInt, formatShare } from "@/lib/format";
import { DM_CONTENT, intentLabel } from "@/lib/labels";
import { PREVIOUS_LABELS, RANGE_LABELS, type InstagramOps } from "@/lib/ops-types";
import { trend } from "@/lib/trend";
import { DonutChart } from "../charts/donut-chart";
import { HorizontalBarChart } from "../charts/horizontal-bar-chart";
import { MultiLineChart } from "../charts/multi-line-chart";
import { RadialGauge } from "../charts/radial-gauge";
import { StackedAreaChart } from "../charts/stacked-area-chart";
import { KpiCard, KpiGrid } from "../kpi-card";
import { Panel } from "../panel";
import { DmKpis, KpiGridSkeleton, PanelSkeleton } from "../sections";
import { StatGrid } from "../stat-grid";
import { ServiceError } from "../states";
import { MessageFailuresTable } from "../tables";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Instagram Login tokens live 60 days and refresh themselves. */
const TOKEN_LIFE_DAYS = 60;

const messagesConfig = {
  replied: { label: "Replied", color: "var(--chart-1)" },
  failed: { label: "Unanswered", color: "var(--chart-5)" },
  open: { label: "Open", color: "var(--chart-4)" },
};
const replyConfig = { reply_p50_ms: { label: "Reply time p50", color: "var(--chart-1)" } };
const CONTENT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function TokenPanel({ account }: { account: InstagramOps["stats"]["account"] }) {
  const now = useNow();
  const days = account?.expires_at ? Math.floor((Date.parse(account.expires_at) - now) / DAY_MS) : null;
  return (
    <Panel title="Access token" description="Time left; it renews itself with 30 days to go">
      <RadialGauge
        ratio={days == null ? null : days / TOKEN_LIFE_DAYS}
        label={days == null ? "Unknown" : `${days} days left`}
        detail={account?.expires_at ? `Expires ${formatDateTime(account.expires_at)}` : "Known after the first renewal (once the token is 24 hours old)"}
        tone={days != null && days < 7 ? "danger" : "primary"}
      />
    </Panel>
  );
}

export function InstagramPage() {
  const { data: ig, error } = useInstagramOps();

  if (!ig) {
    return (
      <>
        {error && <ServiceError error={error} />}
        <KpiGridSkeleton count={8} />
        <PanelSkeleton />
      </>
    );
  }

  const { stats } = ig;
  const { totals, live, previous, intents, outcomes, senders } = stats;
  const finished = totals.replied + totals.failed + totals.expired;
  const webhooks = stats.process.webhooks;

  return (
    <>
      {error && <ServiceError error={error} />}
      <KpiGrid>
        <KpiCard
          icon={Inbox}
          label="Open messages"
          value={formatInt(live.received + live.submitted)}
          detail={`${formatInt(live.submitted)} in recognition · ${formatInt(stats.process.in_flight)} in flight`}
        />
        <DmKpis ig={ig} />
        <KpiCard
          icon={TriangleAlert}
          label="Unanswered"
          value={formatShare(totals.failed + totals.expired, finished)}
          detail={`${formatInt(totals.failed)} failed · ${formatInt(totals.expired)} expired`}
          trend={trend(
            finished ? (totals.failed + totals.expired) / finished : null,
            previous.messages ? previous.unanswered / previous.messages : null,
            "down",
          )}
          trendCaption={PREVIOUS_LABELS[ig.range]}
          spark={stats.series.map((p) => p.failed)}
          sparkTone="danger"
        />
        <KpiCard
          icon={UserPlus}
          label="New people"
          value={formatInt(senders.new)}
          detail={`${formatInt(senders.returning)} returning · ${formatInt(totals.senders)} total`}
          trend={trend(totals.senders, previous.senders, "up")}
          trendCaption={PREVIOUS_LABELS[ig.range]}
        />
        <KpiCard
          icon={CalendarClock}
          label="Retried"
          value={formatInt(totals.retried)}
          detail={`of ${formatInt(totals.messages)} messages`}
          badge={<Badge variant={totals.retried ? "warning" : "success"}>{totals.retried ? "Watch" : "Clean"}</Badge>}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Messages" description={`By outcome · last ${RANGE_LABELS[ig.range]}`} className="lg:col-span-2">
          <StackedAreaChart
            bucket={ig.bucket}
            config={messagesConfig}
            keys={["replied", "failed", "open"] as const}
            data={stats.series.map((p) => ({ bucket: p.bucket, replied: p.replied, failed: p.failed, open: Math.max(0, p.messages - p.replied - p.failed) }))}
          />
        </Panel>
        <Panel title="What was sent" description="DM content">
          <DonutChart
            centerLabel="DMs"
            slices={stats.content_mix.map((item, index) => ({
              key: item.content,
              label: DM_CONTENT[item.content],
              value: item.count,
              color: CONTENT_COLORS[index % CONTENT_COLORS.length]!,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="How recognitions ended" description="Places found, none found, apology, expired">
          <HorizontalBarChart
            items={[
              { label: "Replied with places", value: outcomes.with_places },
              { label: "No places found", value: outcomes.no_places },
              { label: "Apology", value: outcomes.apology },
              { label: "Expired", value: outcomes.expired },
            ]}
          />
        </Panel>
        <Panel title="Reply time" description="From DM to reply, p50">
          <MultiLineChart
            bucket={ig.bucket}
            config={replyConfig}
            keys={["reply_p50_ms"] as const}
            data={stats.series}
            valueFormatter={formatDuration}
            axisFormatter={formatDuration}
          />
        </Panel>
        <TokenPanel account={stats.account} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="What was asked" description="Message intent">
          <HorizontalBarChart
            tone="muted"
            items={[
              ...(["recognize", "help", "unsupported", "erase"] as const).map((intent) => ({ label: intentLabel(intent), value: intents[intent] })),
              ...(intents.unknown > 0 ? [{ label: "Before tracking", value: intents.unknown }] : []),
            ]}
          />
        </Panel>
        <Panel title="Webhooks" description={`Since this process started · ${formatDateTime(webhooks.since)}`} className="lg:col-span-2">
          <StatGrid
            stats={[
              { label: "Deliveries", value: formatInt(webhooks.deliveries) },
              { label: "Messages queued", value: formatInt(webhooks.messages_queued) },
              { label: "Duplicates (skipped)", value: formatInt(webhooks.messages_duplicate) },
              { label: "Bad signature", value: formatInt(webhooks.rejected_signature) },
              { label: "Unknown payload", value: formatInt(webhooks.ignored_envelope) },
              { label: "Other account", value: formatInt(webhooks.other_account) },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Unanswered messages" description="Latest 10">
        <MessageFailuresTable failures={stats.recent_failures} />
      </Panel>
    </>
  );
}
