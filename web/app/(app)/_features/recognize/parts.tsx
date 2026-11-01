"use client";

import * as React from "react";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";

/**
 * The pieces the recognise flow's sheets share beyond the common sheet parts
 * (`shell/sheet-parts`): the labelled field card and the tappable row card.
 */

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** Min height of a tappable row card. */
const ROW_MIN_H = 76;
/** The "add one" row's dashed outline width. */
const DASH = 2;

/**
 * A text field as a sunken card with its label on top. The whole card is the
 * `<label>`, so the field is named by it and a tap anywhere focuses it.
 */
export function FieldCard({ label, children, style, ...rest }: Omit<React.ComponentProps<"label">, "style"> & { label: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label
      {...rest}
      style={{ display: "block", padding: "var(--sp-8)", borderRadius: "var(--r-card-lg)", background: "var(--surface-sunken-on-white)", cursor: "text", ...style }}
    >
      <MicroLabel as="span" style={{ display: "block", marginBottom: "var(--sp-2)" }}>
        {label}
      </MicroLabel>
      {children}
    </label>
  );
}

type TapRowProps = Omit<React.ComponentPropsWithoutRef<"button">, "style" | "title"> & {
  leading: React.ReactNode;
  title: React.ReactNode;
  /** One uppercase grey line under the title. */
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  /** `lg` for a list, `md` for a recent post. */
  size?: "lg" | "md";
  /** The "add one" row: a dashed outline instead of a fill. */
  dashed?: boolean;
};

/** A row card that is one button: leading art, title, meta line, trailing mark. */
export function TapRow({ leading, title, meta, trailing, size = "lg", dashed = false, ...rest }: TapRowProps) {
  const press = usePressable<HTMLButtonElement>(rest);
  return (
    <button
      type="button"
      {...rest}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-7)",
        width: "100%",
        minHeight: size === "lg" ? ROW_MIN_H : "var(--hit-min)",
        padding: size === "lg" ? "var(--sp-7) var(--sp-8)" : "var(--sp-6) var(--sp-7)",
        borderRadius: "var(--r-card-lg)",
        background: dashed ? "transparent" : "var(--surface-sunken)",
        border: dashed ? `${DASH}px dashed var(--bone-400)` : "none",
        textAlign: "left",
        cursor: rest.disabled ? "default" : "pointer",
        ...press.style,
      }}
    >
      {leading}
      <span style={{ display: "block", flex: 1, minWidth: 0 }}>
        <span
          className={size === "lg" ? "ds-title-2" : undefined}
          style={{
            ...ellipsis,
            ...(size === "lg"
              ? { fontWeight: "var(--fw-semibold)", color: dashed ? TEXT_SECONDARY_STRONG : "var(--text-primary)" }
              : {
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--fs-body)",
                  lineHeight: "var(--lh-label)",
                  fontWeight: "var(--fw-bold)",
                  letterSpacing: "var(--tr-tight)",
                  color: "var(--text-primary)",
                }),
          }}
        >
          {title}
        </span>
        {meta ? (
          <MicroLabel as="span" style={{ ...ellipsis, marginTop: "var(--sp-1)" }}>
            {meta}
          </MicroLabel>
        ) : null}
      </span>
      {trailing}
    </button>
  );
}
