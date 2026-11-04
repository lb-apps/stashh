"use client";

import * as React from "react";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";

/** The gap between the sheet's sections. */
export const SECTION_GAP = "var(--sp-9)";

/** The grey block a white sheet groups things on (hours, source, been there). */
export function SunkenCard({ style, children, ...rest }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      style={{
        padding: "var(--sp-8)",
        borderRadius: "var(--r-card-lg)",
        background: "var(--surface-sunken-on-white)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Secondary caption text that clears contrast on white and on the sunken grey. */
export const captionStyle: React.CSSProperties = {
  fontFamily: "var(--font-text)",
  fontSize: "var(--fs-caption)",
  lineHeight: "var(--lh-caption)",
  color: TEXT_SECONDARY_STRONG,
};
