"use client";

import * as React from "react";
import { track } from "@/lib/analytics/analytics";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import { useCopy } from "@/lib/i18n/provider";
import { newestFirst } from "@/lib/stashh/selectors";
import type { CategoryGroup, ListSummary, SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { useSheetNav } from "../shell/sheet-state";
import { homeCopy } from "./copy";

/** A list's stack: its box, the front photo, the two cards fanned out behind it. Sizes in px, tilt in degrees. */
const STACK = { width: 92, height: 74, front: 62, frontRadius: 17, back: 58, backRadius: 16, fanX: 14, tilt: 9, glyph: 24 } as const;
/** The "more lists" stack: two small blank cards behind the count. */
const MORE = { height: 52, front: 42, frontRadius: 12, back: 38, backRadius: 11, fanX: 13 } as const;
/** The cards behind are a little faded, so the front one leads. */
const BACK_OPACITY = 0.85;
const CARD_EDGE = "0 0 0 2px var(--white), var(--sh-thumb)";

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const title: React.CSSProperties = {
  ...ellipsis,
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-body)",
  lineHeight: "var(--lh-label)",
  fontWeight: "var(--fw-bold)",
  letterSpacing: "var(--tr-tight)",
};

/** A card centred in its stack, moved sideways and turned. */
function fanned(size: number, x: number, tilt: number, layer: number): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: size,
    height: size,
    margin: `${-size / 2}px 0 0 ${-size / 2}px`,
    transform: `translateX(${x}px) rotate(${tilt}deg)`,
    zIndex: layer,
    boxShadow: CARD_EDGE,
  };
}

function Row({ stack, onClick, children }: { stack: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  const press = usePressable<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-6)",
        width: "100%",
        minWidth: 0,
        borderRadius: "var(--r-field)",
        textAlign: "left",
        ...press.style,
      }}
    >
      <span aria-hidden="true" style={{ position: "relative", flex: "0 0 auto", width: STACK.width }}>
        {stack}
      </span>
      <span style={{ display: "block", flex: 1, minWidth: 0 }}>{children}</span>
    </button>
  );
}

/**
 * A list on home as a pile of its places: the newest one's photo on top, two
 * cards fanned out behind it, then the list's name and who is in it.
 */
export function ListStackRow({
  name,
  sub,
  photo,
  category,
  onOpen,
}: {
  name: string;
  sub: string;
  photo: string | null;
  category: CategoryGroup;
  onOpen: () => void;
}) {
  return (
    <Row
      onClick={onOpen}
      stack={
        <span style={{ position: "relative", display: "block", height: STACK.height }}>
          <span style={{ ...fanned(STACK.back, -STACK.fanX, -STACK.tilt, 1), borderRadius: STACK.backRadius, background: "var(--grey-200)", opacity: BACK_OPACITY }} />
          <span style={{ ...fanned(STACK.back, STACK.fanX, STACK.tilt, 2), borderRadius: STACK.backRadius, background: "var(--grey-300)", opacity: BACK_OPACITY }} />
          <PlacePhoto
            src={photo}
            category={category}
            glyph={CATEGORY_GLYPH[category]}
            glyphSize={STACK.glyph}
            radius={`${STACK.frontRadius}px`}
            style={fanned(STACK.front, 0, 0, 3)}
          />
        </span>
      }
    >
      <span style={{ ...title, color: "var(--text-primary)" }}>{name}</span>
      <span style={{ ...ellipsis, marginTop: "var(--sp-1)", fontSize: "var(--fs-caption)", lineHeight: "var(--lh-caption)", color: TEXT_SECONDARY_STRONG }}>{sub}</span>
    </Row>
  );
}

/** Opens a list from home, counted as a home list view. */
export function useOpenList(): (list: ListSummary) => void {
  const { open } = useSheetNav();
  return (list) => {
    track("list_viewed", { entry: "home", place_count: list.place_count });
    open({ name: "listdetail", listId: list.id });
  };
}

/** A saved list as a stack: its newest place on top, "X and 2 more" under its name. */
export function SavedListRow({ list, all, onOpen }: { list: ListSummary; all: SavedPlace[]; onOpen: (list: ListSummary) => void }) {
  const copy = useCopy(homeCopy);
  const inList = React.useMemo(() => newestFirst(all.filter((p) => p.list_ids.includes(list.id))), [all, list.id]);
  return (
    <ListStackRow
      name={list.title}
      sub={inList.length ? copy.listSub(inList[0].name, inList.length - 1) : copy.emptyList}
      photo={inList.find((p) => p.thumbnail_url)?.thumbnail_url ?? null}
      category={list.cover_category ?? inList[0]?.category_group ?? "default"}
      onOpen={() => onOpen(list)}
    />
  );
}

/** The lists past the ones shown: a count on a small blank stack. It opens them all. */
export function MoreListsRow({ count, label, onOpen }: { count: string; label: string; onOpen: () => void }) {
  return (
    <Row
      onClick={onOpen}
      stack={
        <span style={{ position: "relative", display: "block", height: MORE.height }}>
          <span style={{ ...fanned(MORE.back, -MORE.fanX, -STACK.tilt, 1), borderRadius: MORE.backRadius, background: "var(--grey-200)" }} />
          <span style={{ ...fanned(MORE.back, MORE.fanX, STACK.tilt, 2), borderRadius: MORE.backRadius, background: "var(--grey-200)" }} />
          <span
            style={{
              ...fanned(MORE.front, 0, 0, 3),
              display: "grid",
              placeItems: "center",
              borderRadius: MORE.frontRadius,
              background: "var(--grey-300)",
              fontFamily: "var(--font-rounded)",
              fontSize: "var(--fs-caption)",
              fontWeight: "var(--fw-black)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--text-primary)",
            }}
          >
            {count}
          </span>
        </span>
      }
    >
      <span style={{ ...title, color: TEXT_SECONDARY_STRONG }}>{label}</span>
    </Row>
  );
}
