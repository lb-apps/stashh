"use client";

import type { ChartConfig } from "@/components/ui/chart";
import type { InstagramSeriesPoint, RecognitionSeriesPoint } from "@/lib/ops-types";
import { StackedSeriesChart } from "./stacked-series-chart";

const requestsConfig = {
  fresh: { label: "Yeni işlem", color: "var(--chart-1)" },
  cache: { label: "Cache", color: "var(--chart-2)" },
  failed: { label: "Hata", color: "var(--chart-5)" },
  pending: { label: "Sürüyor / iptal", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** Recognition requests per bucket: processed fresh, served from cache, failed, other. */
export function RequestsChart({ series, bucket }: { series: RecognitionSeriesPoint[]; bucket: "hour" | "day" }) {
  const data = series.map((point) => {
    const fresh = Math.max(0, point.completed - point.cache_hits);
    return {
      bucket: point.bucket,
      fresh,
      cache: point.cache_hits,
      failed: point.failed,
      pending: Math.max(0, point.requests - point.completed - point.failed),
    };
  });
  return <StackedSeriesChart data={data} bucket={bucket} config={requestsConfig} keys={["fresh", "cache", "failed", "pending"]} />;
}

const messagesConfig = {
  replied: { label: "Yanıtlandı", color: "var(--chart-1)" },
  failed: { label: "Başarısız / süresi doldu", color: "var(--chart-5)" },
  open: { label: "Açık", color: "var(--chart-4)" },
} satisfies ChartConfig;

/** DMs per bucket by outcome. */
export function MessagesChart({ series, bucket }: { series: InstagramSeriesPoint[]; bucket: "hour" | "day" }) {
  const data = series.map((point) => ({
    bucket: point.bucket,
    replied: point.replied,
    failed: point.failed,
    open: Math.max(0, point.messages - point.replied - point.failed),
  }));
  return <StackedSeriesChart data={data} bucket={bucket} config={messagesConfig} keys={["replied", "failed", "open"]} />;
}
