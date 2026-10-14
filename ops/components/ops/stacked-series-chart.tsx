"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatBucket } from "@/lib/format";

/**
 * Counts per time bucket, stacked by outcome. Every series has a legend entry and a
 * tooltip row, so the stack never relies on colour alone.
 */
export function StackedSeriesChart<K extends string>({
  data,
  bucket,
  config,
  keys,
}: {
  data: Array<{ bucket: string } & Record<K, number>>;
  bucket: "hour" | "day";
  config: ChartConfig & Record<K, { label: string; color: string }>;
  /** Bottom to top. */
  keys: readonly K[];
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: -16, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(value: string) => formatBucket(value, bucket)}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipContent labelFormatter={(value) => formatBucket(String(value), bucket)} />}
        />
        {/* Recharts sorts legend items alphabetically by default; keep the stack order. */}
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="outcome"
            fill={`var(--color-${key})`}
            radius={index === keys.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
