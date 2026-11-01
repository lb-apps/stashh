'use client';

import * as React from 'react';

/** Display type size per field size, the gap after a prefix, and the prefix underline. */
const FONT_SIZE = { lg: 52, md: 38 } as const;
const PREFIX_GAP = 12;
const PREFIX_RULE = 3;
/** A centred field is never narrower than this many characters. */
const MIN_CH = 6;

type GhostInputProps = Omit<React.ComponentProps<'input'>, 'style' | 'prefix' | 'size'> & {
  prefix?: React.ReactNode;
  size?: 'lg' | 'md';
  align?: 'center' | 'left';
  /** Styles the row around the input (prefix and field), not the input itself. */
  style?: React.CSSProperties;
};

/**
 * A borderless field set in display type, for a screen whose one job is to
 * take a name or a link. Every input prop (`id`, `ref`, `onPaste`, …) reaches
 * the `<input>`.
 */
export function GhostInput({
  value,
  placeholder = 'First name',
  prefix,
  size = 'lg',
  align = 'center',
  style,
  ...inputProps
}: GhostInputProps) {
  const fs = FONT_SIZE[size];
  const text = typeof value === 'string' ? value : '';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: PREFIX_GAP, ...style }}>
      {prefix ? (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: fs,
            fontWeight: 'var(--fw-semibold)',
            letterSpacing: 'var(--tr-display)',
            color: 'var(--text-primary)',
            borderBottom: `${PREFIX_RULE}px solid var(--text-primary)`,
            lineHeight: 1.05,
          }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        value={value}
        placeholder={placeholder}
        {...inputProps}
        style={{
          flex: align === 'center' ? '0 1 auto' : 1,
          width: align === 'center' ? `${Math.max((text || placeholder).length, MIN_CH)}ch` : '100%',
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          padding: 0,
          textAlign: align,
          fontFamily: 'var(--font-display)',
          fontSize: fs,
          lineHeight: 1.1,
          fontWeight: 'var(--fw-semibold)',
          letterSpacing: 'var(--tr-display)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}
