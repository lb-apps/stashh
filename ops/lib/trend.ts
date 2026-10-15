/**
 * Change against the previous window of the same length, for the trend badges.
 * `goodWhen` says which direction is healthy, so "failures up" reads as bad.
 */
export interface Trend {
  /** Relative change, e.g. 0.12 for +12%; null when there is nothing to compare with. */
  change: number | null;
  direction: "up" | "down" | "flat";
  tone: "good" | "bad" | "neutral";
}

export function trend(current: number | null, previous: number | null, goodWhen: "up" | "down" | "neutral" = "up"): Trend {
  if (current == null || previous == null || previous === 0) {
    return { change: null, direction: "flat", tone: "neutral" };
  }
  const change = (current - previous) / previous;
  const direction = Math.abs(change) < 0.005 ? "flat" : change > 0 ? "up" : "down";
  const tone = direction === "flat" || goodWhen === "neutral" ? "neutral" : direction === goodWhen ? "good" : "bad";
  return { change, direction, tone };
}
