"use client";

import * as React from "react";
import { CategoryOrb } from "@/lib/discovery/components/CategoryOrb";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_SECONDARY_STRONG, TITLE_3 } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { formatCount } from "@/lib/stashh/format";
import { useLists, usePlaces } from "@/lib/stashh/queries";
import { countBy, newestFirst } from "@/lib/stashh/selectors";
import type { CategoryGroup, SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { PlaceRows, Section, SheetBody, SheetTitle } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { libraryCopy } from "./copy";
import { EmptyLibrary } from "./empty-library";
import { LibraryListRow } from "./list-row";

/** The scoreboard numerals: the total, and the two figures beside it. No type token is this large yet. */
const TOTAL_NUMERAL = { fontSize: "88px", lineHeight: "78px" } as const;
/** Category tile orb and glyph, in px. */
const TILE_ORB = 44;
const TILE_ORB_GLYPH = 20;
/** Rows under "Recently saved". */
const RECENT_LIMIT = 6;
/** Skeleton rows while the library loads, and their height in px. */
const SKELETON_ROWS = 4;
const SKELETON_H = 76;

const numeral: React.CSSProperties = {
  fontFamily: "var(--font-rounded)",
  fontWeight: "var(--fw-black)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-primary)",
};

/** "My places": totals, lists, neighbourhoods, categories, and the latest saves. */
export function LibrarySheet() {
  const copy = useCopy(libraryCopy);
  const places = usePlaces();
  const all = places.data;

  return (
    <>
      <SheetTitle title={copy.title} />
      {all == null ? (
        places.isLoading ? <LibrarySkeleton /> : null
      ) : all.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <Library places={all} />
      )}
    </>
  );
}

function Library({ places }: { places: SavedPlace[] }) {
  const t = useT();
  const copy = useCopy(libraryCopy);
  const locale = useIntlLocale();
  const { open } = useSheetNav();
  const lists = useLists().data ?? [];
  const hoods = countBy(places, (p) => p.district);
  const categories = countBy<CategoryGroup>(places, (p) => p.category_group);
  const recent = newestFirst(places).slice(0, RECENT_LIMIT);
  const n = (count: number) => formatCount(count, locale);
  const openPlace = (place: SavedPlace) => open({ name: "place", placeId: place.id });

  return (
    <SheetBody>
      <Totals
        total={{ value: n(places.length), label: copy.placesSaved }}
        side={[
          { value: n(lists.length), label: copy.lists },
          { value: n(hoods.length), label: copy.neighbourhoods },
        ]}
      />

      {lists.length ? (
        <Section label={copy.yourLists}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
            {lists.map((list) => (
              <LibraryListRow
                key={list.id}
                list={list}
                meta={copy.places(n(list.place_count), list.place_count)}
                onOpen={() => open({ name: "listdetail", listId: list.id })}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {hoods.length ? (
        <Section label={copy.byNeighbourhood}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-5)" }}>
            {hoods.map(({ key, count }) => (
              <CountPill key={key} name={key} count={n(count)} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section label={copy.byCategory}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--sp-6)" }}>
          {categories.map(({ key, count }) => (
            <CountTile key={key} category={key} name={t.categories[key]} count={n(count)} />
          ))}
        </div>
      </Section>

      <Section label={copy.recentlySaved}>
        <PlaceRows places={recent} onOpen={openPlace} />
      </Section>
    </SheetBody>
  );
}

type Figure = { value: string; label: string };

/** The scoreboard: one big total, two smaller figures stacked beside it. */
function Totals({ total, side }: { total: Figure; side: Figure[] }) {
  const label = (text: string) => (
    <span className="ds-micro" style={{ display: "block", color: TEXT_SECONDARY_STRONG }}>
      {text}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--sp-8)" }}>
      <div>
        <span style={{ ...numeral, ...TOTAL_NUMERAL, display: "block", letterSpacing: "var(--tr-display)" }}>{total.value}</span>
        <span style={{ display: "block", marginTop: "var(--sp-3)" }}>{label(total.label)}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)", paddingBottom: "var(--sp-3)" }}>
        {side.map((figure) => (
          <div key={figure.label}>
            <span style={{ ...numeral, display: "block", fontSize: "var(--fs-title-1)", lineHeight: "var(--lh-title-2)" }}>{figure.value}</span>
            {label(figure.label)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A neighbourhood and how many places are saved in it. */
function CountPill({ name, count }: { name: string; count: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        height: "var(--hit-min)",
        padding: "0 var(--sp-7)",
        borderRadius: "var(--r-pill)",
        background: "var(--surface-sunken)",
      }}
    >
      <span className="ds-label" style={{ color: "var(--text-primary)" }}>
        {name}
      </span>
      <span style={{ ...numeral, fontSize: "var(--fs-caption)", lineHeight: "var(--lh-caption)", color: "var(--cobalt-500)" }}>{count}</span>
    </span>
  );
}

/** A category tile: its orb, the count, the category's name. */
function CountTile({ category, name, count }: { category: CategoryGroup; name: string; count: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-6)",
        minWidth: 0,
        padding: "var(--sp-7)",
        borderRadius: "var(--r-card)",
        background: "var(--surface-sunken)",
      }}
    >
      <CategoryOrb category={category} size={TILE_ORB}>
        <Glyph icon={CATEGORY_GLYPH[category]} size={TILE_ORB_GLYPH} />
      </CategoryOrb>
      <div style={{ minWidth: 0 }}>
        <span style={{ ...numeral, ...TITLE_3, display: "block" }}>{count}</span>
        <span className="ds-micro" style={{ display: "block", color: TEXT_SECONDARY_STRONG, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
      </div>
    </div>
  );
}

/** Row-card shapes while the library loads, announced once as "Loading". */
function LibrarySkeleton() {
  const t = useT();
  return (
    <SheetBody>
      <div role="status" aria-label={t.common.loading} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} style={{ height: SKELETON_H, borderRadius: "var(--r-card-lg)", background: "var(--surface-sunken)" }} />
        ))}
      </div>
    </SheetBody>
  );
}
