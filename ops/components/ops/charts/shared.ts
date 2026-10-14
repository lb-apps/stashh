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
