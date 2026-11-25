"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics/analytics";
import { purchasePremium, type PremiumOffer } from "@/lib/billing/purchases";
import { api } from "./endpoints";
import { keys } from "./queries";
import { rewardEarned } from "./rewards";
import type { BillingStatus, BillingTask, CategoryGroup, PremiumPeriod, SavedPlace } from "./types";

/**
 * Writes against the library. Edits to a single place are optimistic: the
 * cache changes on tap and rolls back if the request fails, so the UI never
 * waits on the network for a toggle. Refetches after a write run in the
 * background — a screen moves on as soon as the write itself succeeds.
 *
 * Each write reports its analytics event here, once the server has confirmed
 * it: one place per action, whichever screen started it.
 */

function patchPlace(client: QueryClient, placeId: string, patch: (p: SavedPlace) => SavedPlace | null) {
  const previous = client.getQueryData<SavedPlace[]>(keys.places);
  client.setQueryData<SavedPlace[]>(keys.places, (places) =>
    places?.flatMap((p) => {
      if (p.id !== placeId) return [p];
      const next = patch(p);
      return next ? [next] : [];
    }),
  );
  return previous;
}

function useOptimisticPlaceMutation<V>(
  run: (vars: V) => Promise<unknown>,
  placeIdOf: (vars: V) => string,
  patch: (vars: V) => (p: SavedPlace) => SavedPlace | null,
  onSuccess: (vars: V) => void,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onMutate: async (vars: V) => {
      await client.cancelQueries({ queryKey: keys.places });
      return { previous: patchPlace(client, placeIdOf(vars), patch(vars)) };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.places, context.previous);
    },
    onSuccess: (_data, vars) => onSuccess(vars),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.places }),
  });
}

export function useSetVisited() {
  return useOptimisticPlaceMutation(
    ({ placeId, visited }: { placeId: string; visited: boolean }) => api.places.setVisited(placeId, visited),
    (v) => v.placeId,
    ({ visited }) => (p) => ({ ...p, visited_at: visited ? new Date().toISOString() : null }),
    ({ visited }) => track("place_visited", { is_visited: visited }),
  );
}

export function useSetNote() {
  return useOptimisticPlaceMutation(
    ({ placeId, notes }: { placeId: string; notes: string | null }) => api.places.setNote(placeId, notes),
    (v) => v.placeId,
    ({ notes }) => (p) => ({ ...p, notes }),
    ({ notes }) => track("place_note_saved", { has_note: Boolean(notes?.trim()) }),
  );
}

export function useRemovePlace() {
  return useOptimisticPlaceMutation(
    ({ placeId }: { placeId: string }) => api.places.remove(placeId),
    (v) => v.placeId,
    () => () => null,
    () => track("place_removed", {}),
  );
}

/** Files an already-saved place into a list. */
export function useAddToList() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, placeId }: { listId: string; placeId: string }) => api.lists.addPlace(listId, placeId),
    onMutate: async ({ listId, placeId }) => {
      await client.cancelQueries({ queryKey: keys.places });
      return { previous: patchPlace(client, placeId, (p) => (p.list_ids.includes(listId) ? p : { ...p, list_ids: [...p.list_ids, listId] })) };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.places, context.previous);
    },
    onSuccess: () => track("place_added_to_list", {}),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.places });
      void client.invalidateQueries({ queryKey: keys.lists });
    },
  });
}

/** Creates an empty list (or one seeded with saved places). */
export function useCreateList() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; description: string | null; cover: CategoryGroup; placeIds: string[] }) =>
      api.lists.create({ title: body.title, description: body.description, cover_category: body.cover, place_ids: body.placeIds }),
    onSuccess: (_data, { placeIds }) => {
      track("list_created", { entry: placeIds.length ? "place" : "empty" });
      // The database grants the first list's credits; the screen moves on without waiting to hear.
      void refreshForReward(client, "first_list");
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.places });
      void client.invalidateQueries({ queryKey: keys.lists });
    },
  });
}

/**
 * Refetches the plan after a write that can complete a task, and reports the
 * task's credits if this write is what completed it: it was open before and is
 * done now. Without a plan loaded before, there is nothing to compare, so nothing is said.
 */
async function refreshForReward(client: QueryClient, task: BillingTask) {
  const taskIn = (status: BillingStatus | undefined) => status?.tasks.find((t) => t.task === task);
  const before = taskIn(client.getQueryData<BillingStatus>(keys.billing));
  const after = taskIn(await client.fetchQuery({ queryKey: keys.billing, queryFn: api.billing.status, staleTime: 0 }).catch(() => undefined));
  if (before && !before.done && after?.done) rewardEarned({ task, credits: after.credits });
}

/**
 * Premium without payment, while the owner allows it from ops. The answer is
 * the new plan, so the screens show it at once. A switch turned off meanwhile
 * (`PURCHASES_UNAVAILABLE`) refetches the plan, and the paywall falls back to "soon".
 */
export function useMockPurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (period: PremiumPeriod) => api.billing.mockPurchase(period),
    onSuccess: (status, period) => {
      client.setQueryData(keys.billing, status);
      track("premium_purchased", { period, store: "mock" });
    },
    onError: () => void client.invalidateQueries({ queryKey: keys.billing }),
  });
}

/**
 * Buys Premium through Paddle's checkout, then asks the backend to sync the plan from RevenueCat
 * so it shows at once; RevenueCat's webhook gets there too, a moment later. Resolves with
 * "cancelled" when the checkout was closed. A purchase whose sync fails still went through: the
 * plan is refetched instead, and the webhook catches up.
 */
export function usePremiumPurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, offer, language }: { userId: string; offer: PremiumOffer; language: string }) => {
      if ((await purchasePremium(userId, offer, language)) === "cancelled") return { outcome: "cancelled" as const, status: null };
      return { outcome: "purchased" as const, status: await api.billing.sync().catch(() => null) };
    },
    onSuccess: ({ outcome, status }, { offer }) => {
      if (outcome === "cancelled") return;
      if (status) client.setQueryData(keys.billing, status);
      else void client.invalidateQueries({ queryKey: keys.billing });
      track("premium_purchased", { period: offer.period, store: "paddle" });
    },
  });
}
