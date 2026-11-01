"use client";

import * as React from "react";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy } from "@/lib/i18n/provider";
import { useSetNote } from "@/lib/stashh/mutations";
import type { SavedPlace } from "@/lib/stashh/types";
import { placeSheetCopy } from "./copy";
import { SectionLabel } from "../shell/sheet-parts";
import { SECTION_GAP } from "./parts";
import { useDebouncedCommit } from "./use-debounced-commit";

/** Save once typing has paused this long, and on blur. */
const SAVE_AFTER_MS = 600;
const NOTE_ROWS = 2;

/**
 * The reader's own note. Edited locally and saved in the background — after a
 * pause in typing, on blur, and when the sheet closes. Blank saves as no note.
 * Mount it keyed by place, so a different place starts from its own note.
 */
export function NoteField({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const setNote = useSetNote();
  const [draft, setDraft] = React.useState(place.notes ?? "");
  const labelId = React.useId();

  const save = useDebouncedCommit((text: string) => {
    const notes = text.trim() || null;
    if (notes === (place.notes ?? null)) return;
    setNote.mutate({ placeId: place.id, notes });
  }, SAVE_AFTER_MS);

  return (
    <div style={{ marginTop: SECTION_GAP }}>
      <SectionLabel id={labelId}>{copy.yourNote}</SectionLabel>
      <textarea
        aria-labelledby={labelId}
        value={draft}
        rows={NOTE_ROWS}
        placeholder={copy.notePlaceholder}
        onChange={(event) => {
          setDraft(event.target.value);
          save.schedule(event.target.value);
        }}
        onBlur={save.flush}
        // Placeholder in TEXT_SECONDARY_STRONG: the UA grey misses 4.5:1 on the sunken fill.
        className="placeholder:text-(color:--placeholder-ink)"
        style={{
          ["--placeholder-ink" as string]: TEXT_SECONDARY_STRONG,
          display: "block",
          width: "100%",
          padding: "var(--sp-7) var(--sp-8)",
          border: "none",
          borderRadius: "var(--r-card)",
          background: "var(--surface-sunken-on-white)",
          resize: "none",
          fieldSizing: "content",
          fontFamily: "var(--font-text)",
          fontSize: "var(--fs-body)",
          lineHeight: "var(--lh-body)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}
