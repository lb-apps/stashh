import { cn } from "@/lib/utils";

export interface BarListItem {
  label: string;
  value: number;
  /** Shown instead of the raw value (e.g. a duration). */
  display?: string;
  tone?: "primary" | "muted" | "danger" | "success";
}

const FILL = {
  primary: "bg-primary",
  muted: "bg-chart-3",
  danger: "bg-danger",
  success: "bg-success",
} as const;

/**
 * Ranked horizontal bars as plain markup: label and number are text, the bar only
 * repeats the number, so nothing depends on colour or on hovering.
 */
export function BarList({ items, className }: { items: BarListItem[]; className?: string }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <li key={item.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="font-medium tabular-nums">{item.display ?? item.value.toLocaleString("tr-TR")}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className={cn("h-full rounded-full transition-[width] duration-300 ease-out", FILL[item.tone ?? "primary"])}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
