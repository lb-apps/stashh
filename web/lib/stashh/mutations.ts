"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./endpoints";
import { keys } from "./queries";
import type { CategoryGroup, SavedPlace } from "./types";

/**
 * Writes against the library. Edits to a single place are optimistic: the
 * cache changes on tap and rolls back if the request fails, so the UI never
 * waits on the network for a toggle.
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
    onSettled: () => client.invalidateQueries({ queryKey: keys.places }),
  });
}

export function useSetVisited() {
  return useOptimisticPlaceMutation(
    ({ placeId, visited }: { placeId: string; visited: boolean }) => api.places.setVisited(placeId, visited),
    (v) => v.placeId,
    ({ visited }) => (p) => ({ ...p, visited_at: visited ? new Date().toISOString() : null }),
  );
}

export function useSetNote() {
  return useOptimisticPlaceMutation(
    ({ placeId, notes }: { placeId: string; notes: string | null }) => api.places.setNote(placeId, notes),
    (v) => v.placeId,
    ({ notes }) => (p) => ({ ...p, notes }),
  );
}

export function useRemovePlace() {
  return useOptimisticPlaceMutation(
    ({ placeId }: { placeId: string }) => api.places.remove(placeId),
    (v) => v.placeId,
    () => () => null,
  );
}

export function useStartRecognition() {
  return useMutation({ mutationFn: (sourceUrl: string) => api.recognitions.start(sourceUrl) });
}

/**
 * Saves recognised places, then files them into a list (an existing one, a new
 * one, or none). Resolves with the library ids of the saved places, for the
 * pin-drop celebration.
 */
export function useSaveRecognised() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      resultId: string;
      googlePlaceIds: string[];
      into: { kind: "none" } | { kind: "list"; listId: string } | { kind: "new"; title: string; description: string | null; cover: CategoryGroup };
    }) => {
      const { results } = await api.places.addFromRecognition(input.resultId, input.googlePlaceIds);
      const placeIds = results.map((r) => r.place_id);
      if (input.into.kind === "list") {
        const listId = input.into.listId;
        await Promise.all(placeIds.map((id) => api.lists.addPlace(listId, id)));
      } else if (input.into.kind === "new") {
        await api.lists.create({
          title: input.into.title,
          description: input.into.description,
          cover_category: input.into.cover,
          place_ids: placeIds,
        });
      }
      return placeIds;
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.places }),
        client.invalidateQueries({ queryKey: keys.lists }),
        client.invalidateQueries({ queryKey: keys.recents }),
      ]),
  });
}
