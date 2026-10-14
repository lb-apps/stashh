"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOpsControls } from "@/components/ops/ops-provider";
import type { InstagramOps, OpsRange, RecognitionOps } from "@/lib/ops-types";

/** Live panels refresh every 5 s; the payload carries live state and aggregates together. */
const LIVE_INTERVAL_MS = 5_000;

async function getOps<T>(path: string, range: OpsRange): Promise<T> {
  const response = await fetch(`${path}?range=${range}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as T;
}

function useOps<T>(service: "recognitions" | "instagram") {
  const { range, live } = useOpsControls();
  return useQuery({
    queryKey: ["ops", service, range],
    queryFn: () => getOps<T>(`/api/ops/${service}`, range),
    refetchInterval: live ? LIVE_INTERVAL_MS : false,
    // Keep the previous range on screen while the next one loads, instead of a flash of skeletons.
    placeholderData: keepPreviousData,
  });
}

export const useRecognitionOps = () => useOps<RecognitionOps>("recognitions");
export const useInstagramOps = () => useOps<InstagramOps>("instagram");
