import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Four across on large screens, two on tablets, one on phones. */
export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  badge,
}: {
  label: string;
  value: ReactNode;
  /** One line of context under the number: the split, the p95, the time window. */
  detail?: ReactNode;
  icon: LucideIcon;
  badge?: ReactNode;
}) {
  return (
    <Card className="@container/kpi gap-2">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <Icon aria-hidden className="size-4" />
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-2xl font-semibold tracking-tight tabular-nums @[220px]/kpi:text-3xl">{value}</CardTitle>
        {badge && <CardAction>{badge}</CardAction>}
        {detail && <p className="text-sm text-muted-foreground tabular-nums">{detail}</p>}
      </CardHeader>
    </Card>
  );
}

export function KpiCardSkeleton() {
  return (
    <Card className="gap-2">
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-36" />
      </CardHeader>
    </Card>
  );
}
