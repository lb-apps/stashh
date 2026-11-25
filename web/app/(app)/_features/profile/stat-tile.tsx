"use client";

import * as React from "react";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";

/**
 * One figure on the profile: a white tile with a rounded scoreboard numeral
 * over its label. Read label first (a `<dt>`/`<dd>` pair inside a `<dl>`),
 * drawn numeral first.
 */
export function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "var(--sp-7) var(--sp-6)",
        borderRadius: "var(--r-cta)",
        background: "var(--surface-card)",
        boxShadow: "var(--sh-card)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column-reverse",
      }}
    >
      <dt className="ds-nano" style={{ marginTop: "var(--sp-2)", color: TEXT_SECONDARY_STRONG }}>
        {label}
      </dt>
      <dd
        style={{
          margin: 0,
          fontFamily: "var(--font-rounded)",
          fontSize: "var(--fs-title-1)",
          lineHeight: 1,
          fontWeight: "var(--fw-black)",
          fontVariantNumeric: "tabular-nums",
          color: "var(--text-primary)",
        }}
      >
        {children}
      </dd>
    </div>
  );
}
