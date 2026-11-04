"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Button } from "@/lib/discovery/components/Button";
import { GlossyObject } from "@/lib/discovery/components/GlossyObject";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { motionToken, numberToken } from "@/lib/discovery/token-values";
import { useCopy } from "@/lib/i18n/provider";
import { recognizeCopy } from "./copy";

/** How long the card stays before it lets the map have the screen back. */
const CELEBRATION_MS = 4000;
/** The gold object beside the headline. */
const OBJECT = 56;
/** How far the card drops in from. */
const DROP = -16;

/**
 * "Saved" over the map, while the new pins drop in: a floating card at the top
 * that leaves on its own after a few seconds, or on "See them on the map".
 * It animates out first, then calls `onDone`.
 */
export function Celebration({ count, listName, onDone }: { count: number; listName: string | null; onDone: () => void }) {
  const c = useCopy(recognizeCopy);
  const [leaving, setLeaving] = React.useState(false);
  const [motionIn] = React.useState(() => motionToken("--dur-slow", "--ease-spring"));
  const [motionOut] = React.useState(() => motionToken("--dur", "--ease-out"));
  const [enterScale] = React.useState(() => numberToken("--enter-scale", 1));

  React.useEffect(() => {
    const timer = window.setTimeout(() => setLeaving(true), CELEBRATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="app-inset-top" style={{ position: "absolute", insetInline: 0, top: 0, paddingInline: "var(--sp-7)", pointerEvents: "none" }}>
      <motion.section
        aria-label={c.celebration.saved(count, listName)}
        initial={{ opacity: 0, y: DROP, scale: enterScale }}
        animate={leaving ? { opacity: 0, y: DROP, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={leaving ? motionOut : motionIn}
        onAnimationComplete={() => {
          if (leaving) onDone();
        }}
        style={{
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-7)",
          padding: "var(--sp-8)",
          borderRadius: "var(--r-card-lg)",
          background: "var(--surface-card)",
          boxShadow: "var(--sh-float)",
        }}
      >
        <div role="status" style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)" }}>
          <GlossyObject size={OBJECT} tint="gold" floating={false} aria-hidden="true" />
          <div style={{ minWidth: 0 }}>
            <p className="ds-headline" style={{ margin: 0, textWrap: "balance" }}>
              {c.celebration.saved(count, listName)}
            </p>
            <p className="ds-caption" style={{ margin: "var(--sp-1) 0 0", color: TEXT_SECONDARY_STRONG }}>
              {c.celebration.onMap}
            </p>
          </div>
        </div>
        <Button variant="primary" size="md" shape="pill" fullWidth onClick={() => setLeaving(true)}>
          {c.celebration.see}
        </Button>
      </motion.section>
    </div>
  );
}
