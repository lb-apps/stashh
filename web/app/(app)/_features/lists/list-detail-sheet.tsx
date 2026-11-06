"use client";

import * as React from "react";
import { track } from "@/lib/analytics/analytics";
import { CategoryOrb } from "@/lib/discovery/components/CategoryOrb";
import { SheetHeader } from "@/lib/discovery/components/DetentSheet";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { formatCount } from "@/lib/stashh/format";
import { useLists, usePlaces } from "@/lib/stashh/queries";
import type { ListSummary, SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { PlaceRows, QuietNote, SheetBody } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { listCopy } from "./copy";
import { useListOnMap } from "./use-list-on-map";
import { VisitedToggle } from "./visited-toggle";

/** Cover orb and glyph, in px. */
const COVER_ORB = 64;
const COVER_GLYPH = 30;

/** One list: its cover, title and description, then its places — and the map shows only them while it is open. */
export function ListDetailSheet({ listId }: { listId: string }) {
  const t = useT();
  const lists = useLists();
  const list = lists.data?.find((l) => l.id === listId);
  useListOnMap(listId);

  if (!list) {
    return (
      <>
        <SheetHeader>{null}</SheetHeader>
        {lists.data ? (
          <SheetBody>
            <QuietNote>{t.errors.notFound}</QuietNote>
          </SheetBody>
        ) : null}
      </>
    );
  }
  return <ListDetail list={list} />;
}

function ListDetail({ list }: { list: ListSummary }) {
  const copy = useCopy(listCopy);
  const locale = useIntlLocale();
  const { open } = useSheetNav();
  const places = usePlaces().data;
  const inList = React.useMemo(() => places?.filter((p) => p.list_ids.includes(list.id)) ?? [], [places, list.id]);
  const cover = list.cover_category ?? "default";
  const openPlace = (place: SavedPlace) => {
    track("place_viewed", { entry: "list" });
    open({ name: "place", placeId: place.id });
  };

  return (
    <>
      <SheetHeader>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)", paddingBlock: "var(--sp-3) var(--sp-6)" }}>
          <CategoryOrb category={cover} size={COVER_ORB}>
            <Glyph icon={CATEGORY_GLYPH[cover]} size={COVER_GLYPH} />
          </CategoryOrb>
          <div style={{ minWidth: 0 }}>
            <h2 className="ds-display-2" style={{ margin: 0, overflowWrap: "anywhere" }}>
              {list.title}
            </h2>
            <span className="ds-micro" style={{ display: "block", marginTop: "var(--sp-2)", color: TEXT_SECONDARY_STRONG }}>
              {copy.places(formatCount(inList.length, locale), inList.length)}
            </span>
          </div>
        </div>
      </SheetHeader>
      <SheetBody gap="var(--sp-8)">
        {list.description ? (
          <p className="ds-body" style={{ margin: 0, color: TEXT_SECONDARY_STRONG }}>
            {list.description}
          </p>
        ) : null}
        {places == null ? null : inList.length ? (
          <PlaceRows places={inList} onOpen={openPlace} trailing={(place) => <VisitedToggle place={place} />} />
        ) : (
          <QuietNote>{copy.empty}</QuietNote>
        )}
      </SheetBody>
    </>
  );
}
