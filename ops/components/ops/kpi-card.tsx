import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSignedPercent } from "@/lib/format";
import type { Trend } from "@/lib/trend";
import { Sparkline } from "./charts/sparkline";

/** dashboard-01 SectionCards grid: four across on wide screens, two on tablets, one on phones. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

const TREND_BADGE = { good: "success", bad: "danger", neutral: "secondary" } as const;

function TrendBadge({ trend, caption }: { trend: Trend; caption?: string }) {
  if (trend.change == null) return null;
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  return (
    <Badge variant={TREND_BADGE[trend.tone]} className="gap-1 tabular-nums">
      <Icon aria-hidden className="size-3" />
      {formatSignedPercent(trend.change)}
      {caption && <span className="sr-only">{caption}</span>}
    </Badge>
  );
}

/**
 * dashboard-01 section card: the number, a trend badge against the previous window, one
 * line of context, and a sparkline of the same measure over the window.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  detail,
  trend,
  trendCaption,
  spark,
  sparkTone,
  badge,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** One line of context under the number. */
  detail?: ReactNode;
  trend?: Trend;
  /** "vs the previous 24 hours" — read out with the badge; the range is visible in the header. */
  trendCaption?: string;
  spark?: Array<number | null>;
  sparkTone?: "primary" | "danger";
  /** A status badge when there is no trend (e.g. token health). */
  badge?: ReactNode;
}) {
  return (
    <Card className="@container/kpi gap-3 overflow-hidden pt-5 pb-0">
      <CardHeader>
        <CardDescription className="micro-label flex items-center gap-1.5">
          <Icon aria-hidden className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="numeric pt-1 text-[28px] leading-none font-black tracking-[-0.02em] @[230px]/kpi:text-[34px]">{value}</CardTitle>
        <CardAction>{trend ? <TrendBadge trend={trend} caption={trendCaption} /> : badge}</CardAction>
      </CardHeader>
      {/* Context under the number, not a separate band (this style's footer is a grey strip). */}
      <CardFooter className="flex-col items-start gap-1 text-caption">
        {detail && <p className="line-clamp-1 text-muted-foreground tabular-nums">{detail}</p>}
      </CardFooter>
      {spark && spark.length > 1 ? <Sparkline values={spark} tone={sparkTone} /> : <div className="h-3" />}
    </Card>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className="gap-3">
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </CardHeader>
      <CardFooter className="flex-col items-start gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
