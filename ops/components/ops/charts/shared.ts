import { formatBucket } from "@/lib/format";

export type Bucket = "hour" | "day";

/**
 * Charts here do not animate: the data refreshes every few seconds, and an entrance
 * animation would replay on each refresh (hiding value labels while it runs). Numbers
 * update in place instead.
 */

/** Shared x-axis props for every time series: bucket labels, sparse ticks, no chrome. */
export function timeAxis(bucket: Bucket) {
  return {
    dataKey: "bucket",
    tickLine: false,
    axisLine: false,
    tickMargin: 8,
    minTickGap: 28,
    tickFormatter: (value: string) => formatBucket(value, bucket),
  } as const;
}

export const bucketLabel = (bucket: Bucket) => (value: unknown) => formatBucket(String(value), bucket);

/**
 * Colours for parts of a whole (source types, DM content). Cobalt in four depths plus a
 * warm grey: amber and red are kept for values that measure something going wrong.
 */
export const CATEGORY_COLORS = ["var(--cobalt-500)", "var(--cobalt-300)", "var(--cobalt-700)", "var(--cobalt-100)", "var(--grey-500)"];

/** A recognition's steps, in pipeline order, always in the same colours. */
export const STEP_COLORS = {
  fetch: "var(--cobalt-700)",
  analysis: "var(--cobalt-500)",
  match: "var(--cobalt-300)",
  thumbnails: "var(--cobalt-100)",
  save: "var(--grey-500)",
} as const;
