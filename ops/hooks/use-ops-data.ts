"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useOpsControls } from "@/components/ops/ops-provider";
import type { AssistantOps, InstagramOps, MenuDetail, OpsRange, PlaceMenuListItem, RecognitionOps } from "@/lib/ops-types";
import type { BillingOps } from "@/lib/billing-types";

/** Live panels refresh every 5 s; the payload carries live state and aggregates together. */
const LIVE_INTERVAL_MS = 5_000;

async function getOps<T>(path: string, range: OpsRange): Promise<T> {
  const response = await fetch(`${path}?range=${range}`, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? `HTTP ${response.status}`);
  return body as T;
}

function useOps<T>(service: "recognitions" | "instagram" | "assistant" | "billing") {
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
export const useAssistantOps = () => useOps<AssistantOps>("assistant");
export const useBillingOps = () => useOps<BillingOps>("billing");

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error((body as { error?: string })?.error ?? `HTTP ${response.status}`);
  return body as T;
}

export function useMenuList() {
  const { live } = useOpsControls();
  return useQuery({
    queryKey: ["ops", "menus", "list"],
    queryFn: () => getJson<PlaceMenuListItem[]>("/api/ops/menus/list"),
    refetchInterval: live ? LIVE_INTERVAL_MS : false,
    placeholderData: keepPreviousData,
  });
}

export function useMenuDetail(menuId: string | null) {
  return useQuery({
    queryKey: ["ops", "menus", "detail", menuId],
    queryFn: () => getJson<MenuDetail>(`/api/ops/menus/${menuId}`),
    enabled: !!menuId,
  });
}
