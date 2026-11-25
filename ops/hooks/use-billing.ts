"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BillingPerson, BillingSettings, BillingSettingsPatch, BillingStatus, Plan } from "@/lib/billing-types";

/** The dashboard's own error, with the status its route answered. */
class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new RequestError(response.status, body?.error ?? `HTTP ${response.status}`);
  return body as T;
}

const send = (url: string, method: string, body: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const SETTINGS = ["ops", "billing-settings"] as const;
const PEOPLE = ["ops", "billing-people"] as const;

/** The plans and credits settings; refreshed only when the page opens or after a save. */
export function useBillingSettings() {
  return useQuery({
    queryKey: SETTINGS,
    queryFn: async () => readJson<BillingSettings>(await fetch("/api/ops/billing/settings", { cache: "no-store" })),
    refetchInterval: false,
  });
}

/** Saves a change and replaces the cached settings with what the backend now holds. */
export function useSaveBillingSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: BillingSettingsPatch) => readJson<BillingSettings>(await send("/api/ops/billing/settings", "PUT", patch)),
    onSuccess: (settings) => client.setQueryData(SETTINGS, settings),
  });
}

/** People matching a search the owner submitted; nothing is asked before there is one. */
export function useBillingPeople(query: string | null) {
  return useQuery({
    queryKey: [...PEOPLE, query],
    queryFn: async () =>
      readJson<{ items: BillingPerson[] }>(await fetch(`/api/ops/billing/people?q=${encodeURIComponent(query!)}`, { cache: "no-store" })),
    enabled: query !== null,
    placeholderData: keepPreviousData,
  });
}

/**
 * After a change: the person's new status goes into every search that lists them, and the
 * numbers and the ledger load again.
 */
function useApplyStatus() {
  const client = useQueryClient();
  return (userId: string, status: BillingStatus) => {
    client.setQueriesData<{ items: BillingPerson[] }>({ queryKey: PEOPLE }, (data) =>
      data ? { items: data.items.map((person) => (person.user_id === userId ? { ...person, status } : person)) } : data,
    );
    // Not awaited: the change is done; the numbers catch up on their own.
    void client.invalidateQueries({ queryKey: ["ops", "billing"] });
  };
}

/**
 * Adds credits, or removes them when `delta` is negative. `requestId` is made once per
 * submit, so a retry after a lost answer applies the change once; only those are retried.
 */
export function useChangeCredits() {
  const apply = useApplyStatus();
  return useMutation({
    mutationFn: async ({ userId, delta, requestId }: { userId: string; delta: number; requestId: string }) =>
      readJson<BillingStatus>(await send(`/api/ops/billing/people/${userId}/credits`, "POST", { delta, request_id: requestId })),
    retry: (failures, error) => failures < 2 && (!(error instanceof RequestError) || error.status >= 500),
    onSuccess: (status, { userId }) => apply(userId, status),
  });
}

/** Sets a person's plan; `expiresAt` null keeps Premium until it is changed. */
export function useSetPlan() {
  const apply = useApplyStatus();
  return useMutation({
    mutationFn: async ({ userId, plan, expiresAt }: { userId: string; plan: Plan; expiresAt: string | null }) =>
      readJson<BillingStatus>(await send(`/api/ops/billing/people/${userId}/plan`, "PUT", { plan, expires_at: expiresAt })),
    onSuccess: (status, { userId }) => apply(userId, status),
  });
}
