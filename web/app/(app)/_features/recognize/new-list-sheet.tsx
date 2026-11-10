"use client";

import * as React from "react";
import { Button } from "@/lib/discovery/components/Button";
import { CategoryOrb } from "@/lib/discovery/components/CategoryOrb";
import { ScreenFooter } from "@/lib/discovery/components/Screen";
import { GhostInput } from "@/lib/discovery/components/GhostInput";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_DANGER_STRONG } from "@/lib/discovery/pending-tokens";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/discovery/categories";
import { BUTTON_RESET } from "@/lib/discovery/use-pressable";
import { useCopy, useT } from "@/lib/i18n/provider";
import { usePlace } from "@/lib/stashh/queries";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { Section, SheetBody, SheetTitle } from "../shell/sheet-parts";
import type { ListTarget } from "../shell/sheet-state";
import { recognizeCopy } from "./copy";
import { FieldCard } from "./parts";
import { useFileTarget } from "./use-file-target";

/** Cover choices: every category with a pin colour of its own. */
const COVERS = PLACE_CATEGORIES.filter((c) => c !== "default");
/** Cover orb, its glyph, and the columns they sit in. */
const COVER = 56;
const COVER_GLYPH = 24;
const COVER_COLUMNS = 5;
/** The chosen cover's ring: a white gap, then cobalt. */
const COVER_RING = "0 0 0 3px var(--white), 0 0 0 6px var(--cobalt-500)";

/**
 * A new list: title, optional description, cover. Creating it also files
 * whatever the screen was opened for — one saved place, or nothing (an empty list).
 */
export function NewListSheet({ target }: { target: ListTarget }) {
  const c = useCopy(recognizeCopy);
  const t = useT();
  const formId = React.useId();
  const place = usePlace(target.kind === "place" ? target.placeId : null);
  const file = useFileTarget(target);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [cover, setCover] = React.useState<PlaceCategory>(() => (place && place.category_group !== "default" ? place.category_group : COVERS[0]));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || file.pending) return;
    file.intoNew({ title: title.trim(), description: description.trim() || null, cover });
  };

  return (
    <>
      <SheetTitle title={c.newList.title} />
      <SheetBody>
        <form id={formId} onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
          <FieldCard label={c.newList.name}>
            <GhostInput size="md" align="left" value={title} placeholder={c.newList.namePlaceholder} onChange={(e) => setTitle(e.target.value)} />
          </FieldCard>
          <FieldCard label={c.newList.description}>
            <GhostInput size="md" align="left" value={description} placeholder={c.newList.optional} onChange={(e) => setDescription(e.target.value)} />
          </FieldCard>
        </form>

        <Section label={c.newList.cover}>
          <div role="group" aria-label={c.newList.cover} style={{ display: "grid", gridTemplateColumns: `repeat(${COVER_COLUMNS}, 1fr)`, rowGap: "var(--sp-7)", justifyItems: "center" }}>
            {COVERS.map((category) => {
              const chosen = category === cover;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={chosen}
                  aria-label={t.categories[category]}
                  onClick={() => setCover(category)}
                  style={{
                    ...BUTTON_RESET,
                    borderRadius: "var(--r-circle)",
                    boxShadow: chosen ? COVER_RING : "none",
                    transform: chosen ? "scale(1)" : "scale(var(--enter-scale))",
                    transition: "transform var(--dur) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-out)",
                  }}
                >
                  <CategoryOrb category={category} size={COVER}>
                    <Glyph icon={CATEGORY_GLYPH[category]} size={COVER_GLYPH} />
                  </CategoryOrb>
                </button>
              );
            })}
          </div>
        </Section>

        {file.failed ? (
          <p role="alert" className="ds-caption" style={{ margin: 0, color: TEXT_DANGER_STRONG }}>
            {t.errors.generic}
          </p>
        ) : null}
      </SheetBody>
      <ScreenFooter>
        <Button type="submit" form={formId} variant="primary" size="lg" shape="pill" fullWidth disabled={!title.trim() || file.pending}>
          {target.kind === "empty" ? c.newList.create : c.newList.createAndSave}
        </Button>
      </ScreenFooter>
    </>
  );
}
