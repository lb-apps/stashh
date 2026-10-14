"use client";

import { Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatInt, formatShare } from "@/lib/format";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * shadcn chart-pie-donut-text: shares of a whole with the total in the middle. A list
 * beside it repeats every slice as text with its count and share.
 */
export function DonutChart({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const config = Object.fromEntries(slices.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const data = slices.filter((s) => s.value > 0).map((s) => ({ key: s.key, value: s.value, fill: `var(--color-${s.key})` }));

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
      <ChartContainer config={config} className="mx-auto aspect-square w-full max-w-[180px]">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
          <Pie data={data} dataKey="value" nameKey="key" innerRadius={52} strokeWidth={4} isAnimationActive={false}>
            <Label
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox && "cy" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground font-heading text-2xl font-semibold">
                      {formatInt(total)}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                      {centerLabel}
                    </tspan>
                  </text>
                ) : null
              }
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="grid gap-2 text-sm">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
            <span className="flex-1 truncate">{slice.label}</span>
            <span className="font-medium tabular-nums">{formatInt(slice.value)}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">{formatShare(slice.value, total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
