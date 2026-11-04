"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { CategoryOrb } from "@/lib/discovery/components/CategoryOrb";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import type { ListSummary } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";

/** Row height, cover orb and its glyph, in px. */
const ROW_MIN_H = 76;
const ORB = 48;
const ORB_GLYPH = 22;

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/**
 * A list as a full-width row card: cover orb, title, place count, chevron.
 * The whole row opens the list. (Discovery's `ListRow` is a clickable div, so
 * this is a button drawn to the same row-card shape.)
 */
export function LibraryListRow({ list, meta, onOpen }: { list: ListSummary; meta: string; onOpen: (list: ListSummary) => void }) {
  const press = usePressable<HTMLButtonElement>();
  const cover = list.cover_category ?? "default";
  return (
    <button
      type="button"
      onClick={() => onOpen(list)}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-7)",
        width: "100%",
        minHeight: ROW_MIN_H,
        padding: "var(--sp-6) var(--sp-8)",
        borderRadius: "var(--r-card-lg)",
        background: "var(--surface-sunken)",
        textAlign: "left",
        ...press.style,
      }}
    >
      <CategoryOrb category={cover} size={ORB}>
        <Glyph icon={CATEGORY_GLYPH[cover]} size={ORB_GLYPH} />
      </CategoryOrb>
      <span style={{ display: "block", flex: 1, minWidth: 0 }}>
        <span
          style={{
            ...ellipsis,
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-title-2)",
            lineHeight: "var(--lh-title-2)",
            fontWeight: "var(--fw-semibold)",
            letterSpacing: "var(--tr-title)",
            color: "var(--text-primary)",
          }}
        >
          {list.title}
        </span>
        <span className="ds-micro" style={{ ...ellipsis, color: TEXT_SECONDARY_STRONG }}>
          {meta}
        </span>
      </span>
      <Glyph icon={ChevronRight} color="var(--grey-600)" />
    </button>
  );
}
