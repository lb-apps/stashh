"use client";

import { Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { formatInt, formatShare } from "@/lib/format";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * shadcn chart-pie-donut-text: shares of a whole with the total in the middle. A list
 * beside it repeats every slice as text with its count and share, so colour is never the
 * only cue.
 */
export function DonutChart({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const config = Object.fromEntries(slices.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;
  const data = slices.filter((s) => s.value > 0).map((s) => ({ key: s.key, value: s.value, fill: `var(--color-${s.key})` }));

  return (
    // Side by side only when the card is wide enough; a narrow card stacks ring over legend.
    <div className="@container/donut">
      <div className="grid items-center gap-4 @md/donut:grid-cols-[minmax(0,180px)_1fr]">
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
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-[13px] uppercase tracking-[0.08em] font-bold">
                        {centerLabel}
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <ItemGroup className="gap-0!">
          {slices.map((slice) => (
            <Item key={slice.key} role="listitem" size="xs" className="flex-nowrap px-0 py-1.5">
              <ItemMedia>
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: slice.color }} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="block w-full truncate font-normal">{slice.label}</ItemTitle>
              </ItemContent>
              <ItemActions className="tabular-nums">
                <span className="font-medium">{formatInt(slice.value)}</span>
                <span className="w-10 text-right text-muted-foreground">{formatShare(slice.value, total)}</span>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </div>
    </div>
  );
}
