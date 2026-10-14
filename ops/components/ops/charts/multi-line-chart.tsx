"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketLabel, timeAxis, type Bucket } from "./shared";

/**
 * shadcn chart-line-multiple: several measures over time. Lines differ in dash as well as
 * colour, so they stay apart without relying on hue.
 */
export function MultiLineChart<K extends string>({
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
  const dashes = ["0", "6 4", "2 3"];
  return (
    <ChartContainer config={config} className={`aspect-auto w-full ${className}`}>
      <LineChart accessibilityLayer data={data} margin={{ left: -4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis {...timeAxis(bucket)} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={axisFormatter} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" labelFormatter={bucketLabel(bucket)} valueFormatter={valueFormatter} />} />
        {keys.length > 1 && <ChartLegend itemSorter={null} content={<ChartLegendContent />} />}
        {keys.map((key, index) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={`var(--color-${key})`}
            strokeWidth={2}
            strokeDasharray={dashes[index % dashes.length]}
            dot={{ r: 2.5 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
