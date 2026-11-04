'use client';

import * as React from 'react';
import { focusOutline } from '../use-pressable';

const optValue = (o: { value?: string } | string): string =>
  typeof o === 'string' ? o : (o.value ?? '');
const optLabel = (o: { label?: React.ReactNode; value?: string } | string): React.ReactNode =>
  typeof o === 'string' ? o : (o.label ?? o.value);

/** Track height, and the inset the thumb keeps from the track's edge. */
const TRACK_H = 56;
const INSET = 5;
/** Keys that move the choice back or forward, as in a native radio group. */
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp']);
const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);

export type SegmentedOption = string | { value: string; label?: React.ReactNode };

type SegmentedControlProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'onChange'> & {
  options?: SegmentedOption[];
  value?: string;
  onChange?: (next: string) => void;
  onWhite?: boolean;
  style?: React.CSSProperties;
};

/**
 * One-of-few choice on a sunken track with a white thumb. Exposed as a radio
 * group: one tab stop (the chosen segment), arrow keys move the choice, and
 * keyboard focus is drawn around the focused segment.
 */
export function SegmentedControl({ options = [], value, onChange, onWhite = false, style, ...rest }: SegmentedControlProps) {
  const idx = Math.max(0, options.findIndex((o) => optValue(o) === value));
  const n = options.length || 1;
  const [focusVisible, setFocusVisible] = React.useState<string | null>(null);

  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = PREV_KEYS.has(event.key) ? -1 : NEXT_KEYS.has(event.key) ? 1 : 0;
    if (!step || !options.length) return;
    event.preventDefault();
    const next = (idx + step + options.length) % options.length;
    onChange?.(optValue(options[next]));
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      onKeyDown={move}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        height: TRACK_H,
        padding: INSET,
        borderRadius: 'var(--r-field)',
        background: onWhite ? 'var(--surface-field-on-white)' : 'var(--surface-field)',
        boxShadow: 'inset 0 1px 3px rgba(28,25,20,0.06)',
        ...style,
      }}
      {...rest}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: INSET,
          left: `calc(${INSET}px + ${idx} * ((100% - ${2 * INSET}px) / ${n}))`,
          width: `calc((100% - ${2 * INSET}px) / ${n})`,
          height: `calc(100% - ${2 * INSET}px)`,
          borderRadius: `calc(var(--r-field) - ${INSET}px)`,
          background: 'var(--white)',
          boxShadow: 'var(--sh-thumb), var(--gloss-top-strong)',
          transition: 'left var(--dur) var(--ease-spring)',
        }}
      />
      {options.map((o) => {
        const v = optValue(o);
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (value === undefined && v === optValue(options[0])) ? 0 : -1}
            onClick={() => onChange && onChange(v)}
            onFocus={(event) => setFocusVisible(event.currentTarget.matches(':focus-visible') ? v : null)}
            onBlur={() => setFocusVisible(null)}
            style={{
              position: 'relative',
              border: 'none',
              borderRadius: `calc(var(--r-field) - ${INSET}px)`,
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-body)',
              fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              letterSpacing: 'var(--tr-tight)',
              // Inactive labels in grey-800: the lighter greys miss 4.5:1 on the bone track.
              color: active ? 'var(--text-primary)' : 'var(--grey-800)',
              transition: 'color var(--dur-fast) var(--ease-out)',
              WebkitTapHighlightColor: 'transparent',
              ...focusOutline(focusVisible === v),
              outlineOffset: 0,
            }}
          >
            {optLabel(o)}
          </button>
        );
      })}
    </div>
  );
}
