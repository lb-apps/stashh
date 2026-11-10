"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";

/**
 * A round icon button: on its own a grey disc; `plain` draws only the glyph, for
 * inside the search field. `dot` marks it as on (a filter is applied).
 */
export function CircleButton({
  icon,
  label,
  dot = false,
  plain = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  dot?: boolean;
  plain?: boolean;
  onClick: () => void;
}) {
  const press = usePressable<HTMLButtonElement>({}, "var(--press-scale-tight)");
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        position: "relative",
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        width: "var(--hit-min)",
        height: "var(--hit-min)",
        borderRadius: "var(--r-circle)",
        background: plain ? "transparent" : "var(--surface-sunken-on-white)",
        color: "var(--text-primary)",
        ...press.style,
      }}
    >
      <Glyph icon={icon} />
      {dot ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "var(--sp-3)",
            right: "var(--sp-3)",
            width: "var(--sp-4)",
            height: "var(--sp-4)",
            borderRadius: "var(--r-circle)",
            background: "var(--cobalt-500)",
            // A ring in the colour behind the button, so the dot reads as cut out of it.
            boxShadow: `0 0 0 var(--sp-1) ${plain ? "var(--surface-field-on-white)" : "var(--surface-sunken-on-white)"}`,
          }}
        />
      ) : null}
    </button>
  );
}
