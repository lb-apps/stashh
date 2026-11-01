"use client";

import { useAddToList, useCreateList, useSaveRecognised } from "@/lib/stashh/mutations";
import { useLists } from "@/lib/stashh/queries";
import type { CategoryGroup } from "@/lib/stashh/types";
import { useSheetNav, type ListTarget } from "../shell/sheet-state";

export interface NewListInput {
  title: string;
  description: string | null;
  cover: CategoryGroup;
}

/**
 * Files a list target — recognised places, one saved place, or nothing — into
 * an existing list, a new one, or (recognised places only) no list, then moves
 * on: recognised places back to the map with their pins dropping, a place back
 * to its card, an empty new list home.
 */
export function useFileTarget(target: ListTarget) {
  const nav = useSheetNav();
  const saveRecognised = useSaveRecognised();
  const addToList = useAddToList();
  const createList = useCreateList();
  const lists = useLists();

  const saveInto = (into: Parameters<typeof saveRecognised.mutate>[0]["into"], listName: string | null) => {
    if (target.kind !== "recognition") return;
    saveRecognised.mutate(
      { resultId: target.resultId, googlePlaceIds: target.googlePlaceIds, into },
      { onSuccess: (placeIds) => nav.saved(placeIds, listName) },
    );
  };

  return {
    pending: saveRecognised.isPending || addToList.isPending || createList.isPending,
    failed: saveRecognised.isError || addToList.isError || createList.isError,

    intoList(listId: string) {
      if (target.kind === "recognition") saveInto({ kind: "list", listId }, lists.data?.find((l) => l.id === listId)?.title ?? null);
      else if (target.kind === "place") {
        const { placeId } = target;
        addToList.mutate({ listId, placeId }, { onSuccess: () => nav.open({ name: "place", placeId }) });
      } else nav.home();
    },

    intoNew(list: NewListInput) {
      if (target.kind === "recognition") saveInto({ kind: "new", ...list }, list.title);
      else {
        const placeIds = target.kind === "place" ? [target.placeId] : [];
        createList.mutate(
          { ...list, placeIds },
          { onSuccess: () => (target.kind === "place" ? nav.open({ name: "place", placeId: target.placeId }) : nav.home()) },
        );
      }
    },

    /** Recognised places only: save them, in no list. */
    outOfList() {
      saveInto({ kind: "none" }, null);
    },
  };
}
