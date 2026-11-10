"use client";

import * as React from "react";
import { SearchField } from "@/lib/discovery/components/SearchField";

/**
 * A search field for the top of a tab's page. It scrolls with the page until it
 * meets the bar above (`top`, in px), then stays there; content passing under
 * it dissolves, as under any pinned chrome.
 */
export function TabSearch({
  top,
  value,
  onChange,
  placeholder,
  label,
  clearLabel,
  trailing,
}: {
  top: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  clearLabel: string;
  /** Controls inside the field's end, such as a filter. */
  trailing?: React.ReactNode;
}) {
  return (
    <div
      role="search"
      // Above the bar's own soft edge, so the field never fades under it.
      style={{ position: "sticky", top, zIndex: 2, padding: "var(--sp-5) var(--gutter) var(--sp-4)", background: "var(--surface-card)" }}
    >
      <SearchField
        variant="filledOnWhite"
        size="md"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        clearLabel={clearLabel}
        onChange={(event) => onChange(event.target.value)}
        onClear={() => onChange("")}
        trailing={trailing}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          insetInline: 0,
          top: "100%",
          height: "var(--sp-7)",
          background: "linear-gradient(to bottom, var(--surface-card), transparent)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
