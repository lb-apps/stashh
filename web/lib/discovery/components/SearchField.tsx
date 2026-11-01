'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { focusOutline } from '../use-pressable';
import { Glyph } from './Glyph';

/** The field's height and side padding. */
const FIELD_H = 56;
const FIELD_PAD = 18;
/** The search glyph, and the clear button's visible disc and its glyph. */
const SEARCH_GLYPH = 20;
const CLEAR_DOT = 24;
const CLEAR_GLYPH = 14;

type SearchFieldProps = Omit<React.ComponentProps<'input'>, 'style' | 'size'> & {
  onClear?: () => void;
  /** The clear button's accessible name. */
  clearLabel?: string;
  variant?: 'filled' | 'filledOnWhite' | 'floating';
  align?: 'left' | 'center';
  icon?: boolean;
  /** Styles the rounded field, not the input inside it. */
  style?: React.CSSProperties;
};

/**
 * Discovery's pill search field. Every input prop (`aria-label`, `autoFocus`,
 * `enterKeyHint`, `ref`, …) reaches the `<input>`; keyboard focus is drawn on
 * the rounded field around it. Clearing puts the caret back in the field.
 */
export function SearchField({
  ref,
  value,
  placeholder = 'Search for a place…',
  onClear,
  clearLabel = 'Clear',
  variant = 'filled',
  align = 'left',
  icon = true,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: SearchFieldProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = React.useState(false);

  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  const variants: Record<string, React.CSSProperties> = {
    filled: { background: 'var(--surface-field)', boxShadow: 'var(--gloss-top)' },
    filledOnWhite: { background: 'var(--surface-field-on-white)', boxShadow: 'var(--gloss-top)' },
    floating: { background: 'var(--white)', boxShadow: 'var(--sh-float)' },
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: FIELD_H,
        padding: `0 ${FIELD_PAD}px`,
        borderRadius: 'var(--r-pill)',
        ...(variants[variant] || variants.filled),
        // The ring hugs the pill, so it fits inside a pinned header without clipping.
        ...focusOutline(focused),
        outlineOffset: 0,
        ...style,
      }}
    >
      {icon && <Glyph icon={Search} size={SEARCH_GLYPH} style={{ flex: '0 0 auto', display: 'block', color: 'var(--text-tertiary)' }} />}
      <input
        ref={setRefs}
        value={value}
        placeholder={placeholder}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...inputProps}
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          border: 'none',
          padding: 0,
          background: 'transparent',
          // The field draws focus; the input itself shows none.
          outline: 'none',
          boxShadow: 'none',
          textAlign: align,
          fontFamily: 'var(--font-text)',
          fontSize: 'var(--fs-body-lg)',
          fontWeight: 'var(--fw-regular)',
          color: 'var(--text-primary)',
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            onClear?.();
            inputRef.current?.focus();
          }}
          style={{
            // A full hit target around the small disc, pulled into the field's padding.
            width: 'var(--hit-min)',
            height: 'var(--hit-min)',
            marginInlineEnd: `calc((var(--hit-min) - ${CLEAR_DOT}px) / -2)`,
            flex: '0 0 auto',
            display: 'grid',
            placeItems: 'center',
            border: 'none',
            borderRadius: 'var(--r-circle)',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: CLEAR_DOT,
              height: CLEAR_DOT,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--r-circle)',
              background: 'var(--grey-600)',
              color: 'var(--white)',
            }}
          >
            <Glyph icon={X} size={CLEAR_GLYPH} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
