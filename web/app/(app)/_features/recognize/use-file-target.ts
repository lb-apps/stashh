"use client";

import { useAddToList, useCreateList } from "@/lib/stashh/mutations";
import type { CategoryGroup } from "@/lib/stashh/types";
import { useCloseScreen, type ListTarget } from "../shell/sheet-state";

export interface NewListInput {
  title: string;
  description: string | null;
  cover: CategoryGroup;
}

/**
 * Files a list target — one saved place, or nothing — into an existing list or
 * a new one, then closes back to where it started: the place under the list
 * picker, or the screen the new list was made from.
 */
export function useFileTarget(target: ListTarget) {
  const close = useCloseScreen();
  const addToList = useAddToList();
  const createList = useCreateList();

  return {
    pending: addToList.isPending || createList.isPending,
    failed: addToList.isError || createList.isError,

    intoList(listId: string) {
      if (target.kind === "place") addToList.mutate({ listId, placeId: target.placeId }, { onSuccess: () => close() });
      else close();
    },

    // A place's new list is made over the list picker, so the picker closes with it.
    intoNew(list: NewListInput) {
      const placeIds = target.kind === "place" ? [target.placeId] : [];
      createList.mutate({ ...list, placeIds }, { onSuccess: () => close(target.kind === "place" ? 1 : 0) });
    },
  };
}
