"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketLabel, timeAxis, type Bucket } from "./shared";

/** shadcn chart-bar-stacked: one bar per bucket, split by series. */
export function StackedBarChart<K extends string>({
  data,
  bucket,
  config,
  keys,
  valueFormatter,
  axisFormatter,
  className = "h-64",
}: {
  data: Array<{ bucket: string } & Record<K, number | null>>;
  bucket: Bucket;
  config: ChartConfig & Record<K, { label: string; color: string }>;
  keys: readonly K[];
  valueFormatter?: (value: number) => string;
  axisFormatter?: (value: number) => string;
  className?: string;
}) {
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`}>
      <BarChart accessibilityLayer data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis {...timeAxis(bucket)} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={48} tickFormatter={axisFormatter} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={<ChartTooltipContent labelFormatter={bucketLabel(bucket)} valueFormatter={valueFormatter} />}
        />
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="stack"
            fill={`var(--color-${key})`}
            radius={index === keys.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={28}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
