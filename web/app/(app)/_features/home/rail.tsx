"use client";

import * as React from "react";

/**
 * A horizontal strip that bleeds past the screen gutter, so items scroll off
 * the edge instead of stopping short of it. Bottom padding leaves room for
 * the items' shadows. It pans sideways natively; a vertical drag scrolls the screen.
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
      }}
    >
      {children}
    </div>
  );
}
