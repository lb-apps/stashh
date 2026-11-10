"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics/analytics";
import { api } from "./endpoints";
import { keys } from "./queries";
import type { CategoryGroup, SavedPlace } from "./types";

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
    onSuccess: (_data, { placeIds }) => track("list_created", { entry: placeIds.length ? "place" : "empty" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.places });
      void client.invalidateQueries({ queryKey: keys.lists });
    },
  });
}
