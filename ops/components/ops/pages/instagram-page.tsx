"use client";

import { CalendarClock, Inbox, Repeat, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInstagramOps } from "@/hooks/use-ops-data";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatInt, formatShare } from "@/lib/format";
import { RANGE_LABELS, type InstagramStats } from "@/lib/ops-types";
import { BarList, type BarListItem } from "../bar-list";
import { MessagesChart } from "../charts";
import { KpiCard, KpiGrid } from "../kpi-card";
import { Panel } from "../panel";
import { DmKpis, KpiGridSkeleton, PanelSkeleton } from "../sections";
import { ServiceError } from "../states";
import { MessageFailuresTable, intentLabel } from "../tables";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The access token's remaining life; Meta tokens last 60 days and refresh themselves. */
function TokenKpi({ account }: { account: InstagramStats["account"] }) {
  const now = useNow();
  if (!account?.expires_at) {
    return (
      <KpiCard
        icon={CalendarClock}
        label="Erişim anahtarı"
        value="Bilinmiyor"
        detail="Süresi ilk yenilemede öğrenilir (anahtar 24 saatlik olunca)"
        badge={<Badge variant="secondary">Bekliyor</Badge>}
      />
    );
  }
  const days = Math.floor((Date.parse(account.expires_at) - now) / DAY_MS);
  return (
    <KpiCard
      icon={CalendarClock}
      label="Erişim anahtarı"
      value={`${days} gün`}
      detail={`Bitiş ${formatDateTime(account.expires_at)}`}
      badge={<Badge variant={days < 7 ? "danger" : days < 30 ? "warning" : "success"}>{days < 7 ? "Kritik" : days < 30 ? "Yenilenecek" : "Sağlıklı"}</Badge>}
    />
  );
}

export function InstagramPage() {
  const { data, error } = useInstagramOps();

  if (!data) {
    return (
      <>
        {error && <ServiceError error={error} />}
        <KpiGridSkeleton count={8} />
        <PanelSkeleton />
      </>
    );
  }

  const { stats } = data;
  const { totals, intents, live } = stats;
  const finished = totals.replied + totals.failed + totals.expired;
  const intentItems: BarListItem[] = (["recognize", "help", "unsupported", "erase"] as const).map((intent) => ({
    label: intentLabel(intent),
    value: intents[intent],
  }));
  // Messages stored before intents were recorded (2026-10-14) have none.
  if (intents.unknown > 0) intentItems.push({ label: "Kayıt öncesi (bilinmiyor)", value: intents.unknown, tone: "muted" });

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
        <DmKpis stats={stats} />
        <KpiCard
          icon={TriangleAlert}
          label="Yanıtsız kalan"
          value={formatShare(totals.failed + totals.expired, finished)}
          detail={`${formatInt(totals.failed)} başarısız · ${formatInt(totals.expired)} süresi doldu`}
        />
        <KpiCard icon={Repeat} label="Tekrar denenen" value={formatInt(totals.retried)} detail={`${formatInt(totals.messages)} mesajın içinde`} />
        <TokenKpi account={stats.account} />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel title="Mesajlar" description={`Son ${RANGE_LABELS[data.range]}`} className="lg:col-span-2">
          <MessagesChart series={stats.series} bucket={data.bucket} />
        </Panel>
        <Panel title="Ne istendi" description="Mesajların niyeti">
          <BarList items={intentItems} />
        </Panel>
      </div>

      <Panel title="Yanıtsız kalan mesajlar" description="Son 10">
        <MessageFailuresTable failures={stats.recent_failures} />
      </Panel>
    </>
  );
}
