import type { ReactNode } from "react";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: ReactNode;
}

/** The console kit's stat tiles: a sunken block, a micro-label, a rounded black numeral. */
export function StatGrid({ stats, className, size = "lg" }: { stats: Stat[]; className?: string; size?: "lg" | "md" | "sm" }) {
  return (
    <ItemGroup className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
      {stats.map((stat) => (
        <Item key={stat.label} role="listitem" variant="muted" size="sm" className="px-3.5 py-3">
          <ItemContent className="min-w-0 gap-0.5">
            <ItemDescription className="micro-label">{stat.label}</ItemDescription>
            <ItemTitle
              className={cn(
                "w-full",
                size === "sm" ? "block truncate text-caption font-semibold" : cn("numeric font-black whitespace-nowrap", size === "lg" ? "text-[28px] leading-8" : "text-[20px] leading-7"),
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
