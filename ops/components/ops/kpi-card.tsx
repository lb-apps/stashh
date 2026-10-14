import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Trend } from "@/lib/trend";
import { Sparkline } from "./charts/sparkline";

/** dashboard-01 SectionCards grid: four across on wide screens, two on tablets, one on phones. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

const TREND_BADGE = { good: "success", bad: "danger", neutral: "secondary" } as const;

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.change == null) return null;
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" }).format(trend.change);
  return (
    <Badge variant={TREND_BADGE[trend.tone]} className="gap-1 tabular-nums">
      <Icon aria-hidden className="size-3" />
      {percent}
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
  /** "önceki 24 saate göre" — shown with the trend. */
  trendCaption?: string;
  spark?: Array<number | null>;
  sparkTone?: "primary" | "danger";
  /** A status badge when there is no trend (e.g. token health). */
  badge?: ReactNode;
}) {
  return (
    <Card className="@container/kpi gap-3 overflow-hidden pb-0">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon aria-hidden className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-2xl font-semibold tracking-tight tabular-nums @[230px]/kpi:text-3xl">{value}</CardTitle>
        <CardAction>{trend ? <TrendBadge trend={trend} /> : badge}</CardAction>
      </CardHeader>
      {/* Context under the number, not a separate band (this style's footer is a grey strip). */}
      <CardFooter className="flex-col items-start gap-1 rounded-none border-t-0 bg-transparent py-0 text-sm">
        {detail && <p className="line-clamp-1 text-muted-foreground tabular-nums">{detail}</p>}
        {trend?.change != null && trendCaption && <p className="text-xs text-muted-foreground">{trendCaption}</p>}
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
      <CardFooter className="flex-col items-start gap-2 rounded-none border-t-0 bg-transparent">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
