"use client";

import * as React from "react";
import { Button } from "@/lib/discovery/components/Button";
import { Dialog } from "@/lib/discovery/components/Dialog";
import { Switch } from "@/lib/discovery/components/Switch";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { useRemovePlace, useSetVisited } from "@/lib/stashh/mutations";
import type { SavedPlace } from "@/lib/stashh/types";
import { useCloseScreen } from "../shell/sheet-state";
import { placeSheetCopy } from "./copy";
import { SECTION_GAP, SunkenCard, captionStyle } from "./parts";

/** Discovery `Dialog`'s own width; narrower phones get the screen less the gutters. */
const DIALOG_W = 340;

/** The bottom of the sheet: "Been there", then removing the place. */
export function ActionList({ place }: { place: SavedPlace }) {
  return (
    <>
      <BeenThere place={place} />
      <RemovePlace place={place} />
    </>
  );
}

function BeenThere({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const locale = useIntlLocale();
  const setVisited = useSetVisited();
  const hintId = React.useId();
  const visitedAt = place.visited_at ? new Date(place.visited_at) : null;
  const hint = visitedAt
    ? copy.visitedOn(new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(visitedAt))
    : copy.toGo;

  return (
    <SunkenCard style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)", marginTop: SECTION_GAP, padding: "var(--sp-7) var(--sp-8)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-headline)",
            lineHeight: "var(--lh-headline)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "var(--tr-tight)",
            color: "var(--text-primary)",
          }}
        >
          {copy.beenThere}
        </div>
        <div id={hintId} style={captionStyle}>
          {hint}
        </div>
      </div>
      <Switch
        checked={Boolean(visitedAt)}
        label={copy.beenThere}
        aria-describedby={hintId}
        onChange={(visited) => setVisited.mutate({ placeId: place.id, visited })}
      />
    </SunkenCard>
  );
}

function RemovePlace({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const close = useCloseScreen();
  const removePlace = useRemovePlace();
  const [confirming, setConfirming] = React.useState(false);

  return (
    <>
      <Button
        variant="danger"
        size="lg"
        shape="pill"
        fullWidth
        onClick={() => setConfirming(true)}
        style={{ marginTop: "var(--sp-7)", background: "var(--fill-secondary-on-white)" }}
      >
        {copy.remove}
      </Button>
      {confirming ? (
        <ConfirmRemove
          name={place.name}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            removePlace.mutate({ placeId: place.id });
            close();
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Discovery's destructive `Dialog` in a native modal `<dialog>`: the top layer
 * escapes the sheet's transform, the page behind goes inert, Escape and a tap
 * on the scrim cancel.
 */
function ConfirmRemove({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  const copy = useCopy(placeSheetCopy);
  const t = useT();
  const bodyId = React.useId();
  const title = copy.removeTitle(name);

  return (
    <dialog
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      role="alertdialog"
      aria-label={title}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="backdrop:bg-[var(--scrim)]"
      style={{
        width: `min(${DIALOG_W}px, calc(100vw - 2 * var(--gutter)))`,
        maxWidth: "none",
        margin: "auto",
        padding: 0,
        border: "none",
        background: "transparent",
        overflow: "visible",
      }}
    >
      <Dialog
        role="none"
        destructive
        title={title}
        body={<span id={bodyId}>{copy.removeBody}</span>}
        confirmLabel={copy.removeConfirm}
        cancelLabel={t.common.cancel}
        onConfirm={onConfirm}
        onCancel={onCancel}
        style={{ width: "100%" }}
      />
    </dialog>
  );
}
