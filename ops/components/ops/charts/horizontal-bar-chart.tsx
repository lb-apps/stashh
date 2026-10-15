"use client";

import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface HorizontalBarItem {
  label: string;
  value: number;
  /** Text after the bar (a duration, a count); the value itself otherwise. */
  display?: string;
}

/**
 * shadcn chart-bar-horizontal with value labels: names on the axis, the value beside each
 * bar — readable without the tooltip, and short bars never collide with their text.
 */
export function HorizontalBarChart({
  items,
  tone = "primary",
  valueFormatter,
}: {
  items: HorizontalBarItem[];
  tone?: "primary" | "muted" | "danger";
  valueFormatter?: (value: number) => string;
}) {
  const color = { primary: "var(--chart-1)", muted: "var(--cobalt-300)", danger: "var(--chart-5)" }[tone];
  const config = { value: { label: "Value", color } } satisfies ChartConfig;
  const data = items.map((item) => ({ ...item, display: item.display ?? valueFormatter?.(item.value) ?? item.value.toLocaleString("en-US") }));

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(72, data.length * 36) }}>
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 88 }}>
        <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 15, fill: "var(--foreground)" }} />
        <XAxis dataKey="value" type="number" hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" hideLabel nameKey="label" valueFormatter={valueFormatter} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={6} barSize={20} minPointSize={2} isAnimationActive={false}>
          <LabelList dataKey="display" position="right" offset={8} className="fill-foreground font-numeric font-bold" fontSize={15} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
