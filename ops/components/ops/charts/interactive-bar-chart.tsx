"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketLabel, timeAxis, type Bucket } from "./shared";

export interface InteractiveMetric<K extends string> {
  key: K;
  label: string;
  /** The window's total or summary, shown on the tab. */
  total: string;
  format: (value: number) => string;
}

/**
 * shadcn chart-bar-interactive: the header tabs carry each metric's window total; choosing
 * one redraws the bars for that metric.
 */
export function InteractiveBarChart<K extends string>({
  title,
  description,
  data,
  bucket,
  metrics,
}: {
  title: string;
  description: string;
  data: Array<{ bucket: string } & Record<K, number | null>>;
  bucket: Bucket;
  metrics: InteractiveMetric<K>[];
}) {
  const [active, setActive] = useState<K>(metrics[0]!.key);
  const metric = metrics.find((m) => m.key === active) ?? metrics[0]!;
  const config = { [metric.key]: { label: metric.label, color: "var(--chart-1)" } } satisfies ChartConfig;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-col items-stretch gap-0 border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 sm:py-5">
          <CardTitle className="font-heading text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="grid grid-cols-2 sm:flex" role="tablist" aria-label="Metric shown">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={m.key === active}
              data-active={m.key === active}
              onClick={() => setActive(m.key)}
              className="relative flex flex-col justify-center gap-1 border-t px-5 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring data-[active=true]:bg-accent sm:border-t-0 sm:border-l sm:px-6 sm:py-5"
            >
              <span className="text-xs text-muted-foreground">{m.label}</span>
              <span className="font-heading text-lg leading-none font-semibold tabular-nums sm:text-2xl">{m.total}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 py-4 sm:p-6">
        <ChartContainer config={config} className="aspect-auto h-64 w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis {...timeAxis(bucket)} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={metric.format} />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={<ChartTooltipContent labelFormatter={bucketLabel(bucket)} valueFormatter={metric.format} />}
            />
            <Bar dataKey={metric.key} fill={`var(--color-${metric.key})`} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
