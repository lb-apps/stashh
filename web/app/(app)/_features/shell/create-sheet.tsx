"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ListPlus, Plus, type LucideIcon } from "lucide-react";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { IconButton } from "@/lib/discovery/components/IconButton";
import { Sheet } from "@/lib/discovery/components/Sheet";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { motionToken } from "@/lib/discovery/token-values";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import { useCopy, useT } from "@/lib/i18n/provider";
import { shellCopy } from "./copy";

/** Above the screens and the + button. */
const LAYER = 50;
/** An option's row height and its cobalt disc, in px. */
const OPTION_MIN_H = 76;
const OPTION_DISC = 44;
/** The + glyph on the create button, in px. */
const FAB_GLYPH = 28;

/** The one primary action on home: create something (it asks what). */
export function CreateFab({ onCreate }: { onCreate: () => void }) {
  const c = useCopy(shellCopy);
  return (
    <IconButton
      variant="cobalt"
      size="xl"
      label={c.create}
      aria-haspopup="dialog"
      onClick={onCreate}
      style={{ position: "absolute", right: "var(--sp-7)", bottom: "max(var(--safe-area-bottom, env(safe-area-inset-bottom)), var(--sp-7))", zIndex: 1 }}
    >
      <Glyph icon={Plus} size={FAB_GLYPH} />
    </IconButton>
  );
}

/** Puts focus on the first option once it is in the document, without scrolling — a DOM sync, not state. */
function focusOnMount(node: HTMLButtonElement | null) {
  node?.focus({ preventScroll: true });
}

/**
 * "What do you want to create?" — a half sheet over the screen, opened from the
 * + button: one row per thing the reader can make, for now a list. The scrim,
 * Escape and the close button dismiss it. Mount it inside `AnimatePresence` so it slides away.
 */
export function CreateSheet({ onClose, onList }: { onClose: () => void; onList: () => void }) {
  const c = useCopy(shellCopy);
  const t = useT();
  const reduceMotion = useReducedMotion();
  const sheet = motionToken("--dur-sheet", "--ease-out");
  const scrim = motionToken("--dur", "--ease-out");
  const hidden = reduceMotion ? { opacity: 0 } : { y: "100%" };
  const shown = reduceMotion ? { opacity: 1 } : { y: 0 };

  return (
    <div
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      style={{ position: "absolute", inset: 0, zIndex: LAYER }}
    >
      <motion.div
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: scrim.duration, ease: scrim.ease }}
        style={{ position: "absolute", inset: 0, background: "var(--scrim)" }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={c.createTitle}
        initial={hidden}
        animate={shown}
        exit={hidden}
        transition={{ duration: sheet.duration, ease: sheet.ease }}
        style={{ position: "absolute", insetInline: 0, bottom: 0 }}
      >
        <Sheet
          title={c.createTitle}
          onClose={onClose}
          closeLabel={t.common.close}
          style={{ paddingBottom: "max(var(--safe-area-bottom, env(safe-area-inset-bottom)), var(--sp-9))" }}
        >
          <div style={{ marginTop: "var(--sp-8)", display: "flex", flexDirection: "column", gap: "var(--row-gap)" }}>
            <CreateOption ref={focusOnMount} icon={ListPlus} title={c.createList} sub={c.createListSub} onClick={onList} />
          </div>
        </Sheet>
      </motion.div>
    </div>
  );
}

/** One thing to create: a cobalt disc with its glyph, its name, a line on what it is for. */
function CreateOption({
  ref,
  icon,
  title,
  sub,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  icon: LucideIcon;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const press = usePressable<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-7)",
        width: "100%",
        minHeight: OPTION_MIN_H,
        padding: "var(--sp-6) var(--sp-8)",
        borderRadius: "var(--r-card-lg)",
        background: "var(--surface-sunken)",
        textAlign: "left",
        ...press.style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
          width: OPTION_DISC,
          height: OPTION_DISC,
          borderRadius: "var(--r-circle)",
          background: "var(--fill-primary)",
          boxShadow: "var(--gloss-top)",
          color: "var(--white)",
        }}
      >
        <Glyph icon={icon} />
      </span>
      <span style={{ display: "block", minWidth: 0 }}>
        <span className="ds-headline" style={{ display: "block" }}>
          {title}
        </span>
        <span className="ds-caption" style={{ display: "block", color: TEXT_SECONDARY_STRONG }}>
          {sub}
        </span>
      </span>
    </button>
  );
}
