import { cn } from "@/lib/utils";

const TONE = {
  up: "bg-success",
  down: "bg-danger",
  unknown: "bg-muted-foreground/40",
  live: "bg-primary",
} as const;

/** A coloured dot; always paired with text, never the only signal. */
export function StatusDot({ state, pulse = false, className }: { state: keyof typeof TONE; pulse?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-flex size-2 shrink-0", className)}>
      {pulse && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", TONE[state])} />}
      <span className={cn("relative inline-flex size-2 rounded-full", TONE[state])} />
    </span>
  );
}
