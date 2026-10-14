"use client";

import * as React from "react";

/**
 * App-local, not design-system API. Discovery's input is `SearchField` (a pill
 * with a leading glyph); the console needs a labelled URL field. Built from
 * the same tokens so it sits correctly next to Discovery components. It sits
 * on a white panel, so it takes the on-white field fill.
 */
type TextFieldProps = Omit<React.ComponentPropsWithoutRef<"input">, "style"> & {
  label: string;
  hint?: React.ReactNode;
  style?: React.CSSProperties;
};

export function TextField({ label, hint, id, style, ...rest }: TextFieldProps) {
  const generated = React.useId();
  const inputId = id ?? generated;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      <label
        htmlFor={inputId}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-micro)",
          lineHeight: "var(--lh-micro)",
          fontWeight: "var(--fw-bold)",
          letterSpacing: "var(--tr-micro)",
          textTransform: "uppercase",
          // Not --text-tertiary: grey-500 on white is ~2:1, under AA.
          color: "var(--grey-800)",
        }}
      >
        {label}
      </label>
      <input
        id={inputId}
        style={{
          height: 56,
          padding: "0 18px",
          border: "none",
          borderRadius: "var(--r-field)",
          background: "var(--surface-field-on-white)",
          boxShadow: "var(--gloss-top)",
          fontFamily: "var(--font-text)",
          fontSize: "var(--fs-body-lg)",
          color: "var(--text-primary)",
        }}
        {...rest}
      />
      {hint ? (
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--fs-caption)", color: "var(--grey-800)" }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
