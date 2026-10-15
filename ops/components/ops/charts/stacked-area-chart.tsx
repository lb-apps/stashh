"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketLabel, timeAxis, type Bucket } from "./shared";

/** shadcn chart-area-interactive: series stacked, each with its own gradient fill. */
export function StackedAreaChart<K extends string>({
  data,
  bucket,
  config,
  keys,
  className = "h-64",
}: {
  data: Array<{ bucket: string } & Record<K, number>>;
  bucket: Bucket;
  config: ChartConfig & Record<K, { label: string; color: string }>;
  /** Bottom to top. */
  keys: readonly K[];
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`}>
      <AreaChart accessibilityLayer data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          {keys.map((key) => (
            <linearGradient key={key} id={`fill-${id}-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${key})`} stopOpacity={0.7} />
              <stop offset="95%" stopColor={`var(--color-${key})`} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis {...timeAxis(bucket)} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={bucketLabel(bucket)} />} />
        {keys.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            stackId="stack"
            stroke={`var(--color-${key})`}
            strokeWidth={1.5}
            fill={`url(#fill-${id}-${key})`}
            isAnimationActive={false}
          />
        ))}
        {/* Recharts sorts legend items alphabetically by default; keep the stack order. */}
        <ChartLegend itemSorter={null} content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}
