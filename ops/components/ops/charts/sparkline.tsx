"use client";

import { useId } from "react";
import { Area, AreaChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

/** A tiny trend line under a KPI: shape only, no axes; the number above carries the value. */
export function Sparkline({ values, tone = "primary" }: { values: Array<number | null>; tone?: "primary" | "danger" }) {
  const id = useId().replace(/:/g, "");
  const color = tone === "danger" ? "var(--chart-5)" : "var(--chart-1)";
  const config = { value: { label: "Value", color } } satisfies ChartConfig;
  const data = values.map((value, index) => ({ index, value: value ?? 0 }));

  return (
    <ChartContainer config={config} className="aspect-auto h-12 w-full" aria-hidden>
      <AreaChart data={data} accessibilityLayer={false} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={1.75}
          fill={`url(#spark-${id})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
