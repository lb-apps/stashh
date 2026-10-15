"use client";

import { Label, PolarAngleAxis, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { DASH, formatPercent } from "@/lib/format";

/**
 * shadcn chart-radial-text: one ratio as an arc on a track, the number in the middle.
 * Radii are relative so the gauge fits any column width.
 */
export function RadialGauge({
  ratio,
  label,
  detail,
  tone = "primary",
}: {
  /** 0–1, or null when there is nothing to measure yet. */
  ratio: number | null;
  label: string;
  detail?: string;
  tone?: "primary" | "danger" | "success";
}) {
  const color = { primary: "var(--chart-1)", danger: "var(--chart-5)", success: "var(--color-success)" }[tone];
  const config = { value: { label, color } } satisfies ChartConfig;
  const percent = ratio == null ? 0 : Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const text = ratio == null ? DASH : formatPercent(percent / 100);

  return (
    <div className="grid justify-items-center gap-1 text-center">
      <ChartContainer config={config} className="aspect-square w-full max-w-[140px]" role="img" aria-label={`${label}: ${text}`}>
        <RadialBarChart data={[{ value: percent }]} startAngle={90} endAngle={-270} innerRadius="72%" outerRadius="100%" barSize={10}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" fill="var(--color-value)" background={{ fill: "var(--muted)" }} cornerRadius={10} isAnimationActive={false} />
          {/* As in shadcn's example: the centre label belongs to the radius axis, which knows the centre. */}
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox && "cy" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle" className="fill-foreground font-heading text-base font-semibold">
                    {text}
                  </text>
                ) : null
              }
            />
          </PolarRadiusAxis>
        </RadialBarChart>
      </ChartContainer>
      <p className="font-heading text-body font-semibold">{label}</p>
      {detail && <p className="numeric text-caption text-muted-foreground">{detail}</p>}
    </div>
  );
}
