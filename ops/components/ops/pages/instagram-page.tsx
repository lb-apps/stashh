"use client";

import { CalendarClock, Inbox, TriangleAlert, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInstagramOps } from "@/hooks/use-ops-data";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatDuration, formatInt, formatShare } from "@/lib/format";
import { DM_CONTENT } from "@/lib/labels";
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
import { ServiceError } from "../states";
import { MessageFailuresTable, intentLabel } from "../tables";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Instagram Login tokens live 60 days and refresh themselves. */
const TOKEN_LIFE_DAYS = 60;

const messagesConfig = {
  replied: { label: "Yanıtlandı", color: "var(--chart-1)" },
  failed: { label: "Yanıtsız", color: "var(--chart-5)" },
  open: { label: "Açık", color: "var(--chart-4)" },
};
const replyConfig = { reply_p50_ms: { label: "Yanıt süresi p50", color: "var(--chart-1)" } };
const CONTENT_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function TokenPanel({ account }: { account: InstagramOps["stats"]["account"] }) {
  const now = useNow();
  const days = account?.expires_at ? Math.floor((Date.parse(account.expires_at) - now) / DAY_MS) : null;
  return (
    <Panel title="Erişim anahtarı" description="Kalan ömür; kendini 30 gün kala yeniler">
      <RadialGauge
        ratio={days == null ? null : days / TOKEN_LIFE_DAYS}
        label={days == null ? "Bilinmiyor" : `${days} gün kaldı`}
        detail={account?.expires_at ? `Bitiş ${formatDateTime(account.expires_at)}` : "İlk yenilemede öğrenilir (anahtar 24 saatlik olunca)"}
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
          label="Açık mesaj"
          value={formatInt(live.received + live.submitted)}
          detail={`${formatInt(live.submitted)} tanımada · ${formatInt(stats.process.in_flight)} işleniyor`}
        />
        <DmKpis ig={ig} />
        <KpiCard
          icon={TriangleAlert}
          label="Yanıtsız kalan"
          value={formatShare(totals.failed + totals.expired, finished)}
          detail={`${formatInt(totals.failed)} başarısız · ${formatInt(totals.expired)} süresi doldu`}
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
          label="Yeni kişi"
          value={formatInt(senders.new)}
          detail={`${formatInt(senders.returning)} geri dönen · toplam ${formatInt(totals.senders)}`}
          trend={trend(totals.senders, previous.senders, "up")}
          trendCaption={PREVIOUS_LABELS[ig.range]}
        />
        <KpiCard
          icon={CalendarClock}
          label="Tekrar denenen"
          value={formatInt(totals.retried)}
          detail={`${formatInt(totals.messages)} mesajın içinde`}
          badge={<Badge variant={totals.retried ? "warning" : "success"}>{totals.retried ? "Dikkat" : "Temiz"}</Badge>}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Mesajlar" description={`Sonuca göre · son ${RANGE_LABELS[ig.range]}`} className="lg:col-span-2">
          <StackedAreaChart
            bucket={ig.bucket}
            config={messagesConfig}
            keys={["replied", "failed", "open"] as const}
            data={stats.series.map((p) => ({ bucket: p.bucket, replied: p.replied, failed: p.failed, open: Math.max(0, p.messages - p.replied - p.failed) }))}
          />
        </Panel>
        <Panel title="Ne gönderildi" description="DM içeriği">
          <DonutChart
            centerLabel="DM"
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
        <Panel title="Tanımalar nasıl bitti" description="Mekân bulunan, bulunamayan, özür, süresi dolan">
          <HorizontalBarChart
            items={[
              { label: "Mekânlarla yanıtlandı", value: outcomes.with_places },
              { label: "Mekân bulunamadı", value: outcomes.no_places },
              { label: "Özür mesajı", value: outcomes.apology },
              { label: "Süresi doldu", value: outcomes.expired },
            ]}
          />
        </Panel>
        <Panel title="Yanıt süresi" description="DM'den yanıta, p50">
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
        <Panel title="Ne istendi" description="Mesajların niyeti">
          <HorizontalBarChart
            tone="muted"
            items={[
              ...(["recognize", "help", "unsupported", "erase"] as const).map((intent) => ({ label: intentLabel(intent), value: intents[intent] })),
              ...(intents.unknown > 0 ? [{ label: "Kayıt öncesi", value: intents.unknown }] : []),
            ]}
          />
        </Panel>
        <Panel title="Webhook" description={`Bu süreç başladığından beri · ${formatDateTime(webhooks.since)}`} className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["Teslimat", webhooks.deliveries],
                ["Kuyruğa giren mesaj", webhooks.messages_queued],
                ["Tekrar gelen (atlandı)", webhooks.messages_duplicate],
                ["İmza reddi", webhooks.rejected_signature],
                ["Tanınmayan gövde", webhooks.ignored_envelope],
                ["Başka hesap", webhooks.other_account],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-heading text-xl font-semibold tabular-nums">{formatInt(value)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="Yanıtsız kalan mesajlar" description="Son 10">
        <MessageFailuresTable failures={stats.recent_failures} />
      </Panel>
    </>
  );
}
