"use client";

import * as React from "react";
import { useSheetDetent } from "@/lib/discovery/components/DetentSheet";

/**
 * A horizontal strip that bleeds past the screen gutter, so items scroll off
 * the edge instead of stopping short of it. Bottom padding leaves room for
 * the items' shadows. It pans sideways natively; a vertical drag moves the
 * sheet at peek and scrolls the sheet's content at full height.
 */
export function Rail({
  children,
  gap = "var(--sp-6)",
  paddingBottom = "var(--sp-8)",
  "aria-label": ariaLabel,
  role,
}: {
  children: React.ReactNode;
  gap?: string;
  paddingBottom?: string;
  "aria-label"?: string;
  role?: React.AriaRole;
}) {
  const detent = useSheetDetent();
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className="ds-scroll-hide"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap,
        marginInline: "calc(-1 * var(--gutter))",
        padding: `var(--sp-1) var(--gutter) ${paddingBottom}`,
        overflowX: "auto",
        overscrollBehaviorX: "contain",
        touchAction: detent === "full" ? "pan-x pan-y" : "pan-x",
      }}
    >
      {children}
    </div>
  );
}
