"use client";

import * as React from "react";

/**
 * App-local, not design-system API. Discovery has no spinner yet — the product
 * shows glossy objects at loading states instead. The console needs a plain
 * indeterminate one; if a second surface needs it, promote it into
 * `lib/discovery` rather than copying it.
 */
export function Spinner({ size = 20, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        // currentColor, so it reads on whatever it sits on — cobalt text on
        // bone, white inside a primary button.
        border: `${Math.max(2, Math.round(size / 9))}px solid color-mix(in srgb, currentColor 25%, transparent)`,
        borderTopColor: "currentColor",
        animation: "ds-spin 720ms linear infinite",
      }}
    >
      <style>{"@keyframes ds-spin{to{transform:rotate(360deg)}}"}</style>
    </span>
  );
}
