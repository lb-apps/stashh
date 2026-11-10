"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";
import { CategoryOrb } from "@/lib/discovery/components/CategoryOrb";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_DANGER_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useT } from "@/lib/i18n/provider";
import { useLists, usePlace } from "@/lib/stashh/queries";
import type { ListSummary } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { SheetBody, SheetTitle } from "../shell/sheet-parts";
import { useCloseScreen, useSheetNav, type ListTarget } from "../shell/sheet-state";
import { recognizeCopy } from "./copy";
import { TapRow } from "./parts";
import { useFileTarget } from "./use-file-target";

/** List disc, its glyph, and the trailing mark. */
const DISC = 48;
const DISC_GLYPH = 22;
const MARK = 36;
const MARK_GLYPH = 18;

/** Save to a list: a saved place goes into the list tapped, or a new one. */
export function ListPickerSheet({ target }: { target: ListTarget }) {
  const c = useCopy(recognizeCopy);
  const t = useT();
  const nav = useSheetNav();
  const close = useCloseScreen();
  const lists = useLists();
  const place = usePlace(target.kind === "place" ? target.placeId : null);
  const file = useFileTarget(target);

  const sub = place ? c.picker.subPlace(place.name) : c.picker.subEmpty;

  // A list the place is already in has nothing to file: back to the place.
  const pick = (list: ListSummary) => {
    if (target.kind === "place" && place?.list_ids.includes(list.id)) close();
    else file.intoList(list.id);
  };

  return (
    <>
      <SheetTitle title={c.picker.title} sub={sub} />
      <SheetBody>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)" }}>
          {target.kind !== "empty"
            ? lists.data?.map((list) => (
                <ListChoiceRow key={list.id} list={list} inList={place?.list_ids.includes(list.id) ?? false} disabled={file.pending} onPick={() => pick(list)} />
              ))
            : null}
          <TapRow
            dashed
            disabled={file.pending}
            leading={
              <span
                aria-hidden="true"
                style={{
                  flex: "0 0 auto",
                  width: DISC,
                  height: DISC,
                  borderRadius: "var(--r-circle)",
                  display: "grid",
                  placeItems: "center",
                  background: "var(--bone-200)",
                  color: "var(--cobalt-500)",
                }}
              >
                <Glyph icon={Plus} size={DISC_GLYPH} />
              </span>
            }
            title={c.picker.newList}
            onClick={() => nav.open({ name: "newlist", target })}
          />
        </div>
        {file.failed ? (
          <p role="alert" className="ds-caption" style={{ margin: 0, color: TEXT_DANGER_STRONG }}>
            {t.errors.generic}
          </p>
        ) : null}
      </SheetBody>
    </>
  );
}

/** A list to file into: its cover disc, title and size, and a mark — a plus, or a tick when the place is already in it. */
function ListChoiceRow({ list, inList, disabled, onPick }: { list: ListSummary; inList: boolean; disabled: boolean; onPick: () => void }) {
  const c = useCopy(recognizeCopy);
  const cover = list.cover_category ?? "default";
  return (
    <TapRow
      disabled={disabled}
      onClick={onPick}
      leading={
        <CategoryOrb category={cover} size={DISC}>
          <Glyph icon={CATEGORY_GLYPH[cover]} size={DISC_GLYPH} />
        </CategoryOrb>
      }
      title={list.title}
      meta={inList ? c.picker.inList : c.picker.count(list.place_count)}
      trailing={
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            width: MARK,
            height: MARK,
            borderRadius: "var(--r-circle)",
            display: "grid",
            placeItems: "center",
            background: inList ? "var(--fill-selected)" : "var(--grey-300)",
            boxShadow: inList ? "var(--gloss-top-strong)" : undefined,
            color: "var(--white)",
          }}
        >
          <Glyph icon={inList ? Check : Plus} size={MARK_GLYPH} />
        </span>
      }
    />
  );
}
