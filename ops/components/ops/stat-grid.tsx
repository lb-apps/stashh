import type { ReactNode } from "react";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: ReactNode;
}

/** Labelled numbers as muted tiles: counters, facts, totals. */
export function StatGrid({ stats, className, size = "lg" }: { stats: Stat[]; className?: string; size?: "lg" | "sm" }) {
  return (
    <ItemGroup className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
      {stats.map((stat) => (
        <Item key={stat.label} role="listitem" variant="muted" size="sm">
          <ItemContent className="min-w-0 gap-0.5">
            <ItemDescription className="line-clamp-1 text-xs">{stat.label}</ItemDescription>
            <ItemTitle
              className={cn(
                "w-full tabular-nums",
                size === "lg" ? "font-heading text-xl font-semibold" : "block truncate text-sm font-medium",
              )}
            >
              {stat.value}
            </ItemTitle>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
