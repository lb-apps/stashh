'use client';

import * as React from 'react';
import { BUTTON_RESET, usePressable } from '../use-pressable';

type ScopePillProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style'> & {
  active: boolean;
  /** Leading glyph, drawn in the label colour. */
  icon?: React.ReactNode;
  style?: React.CSSProperties;
};

/**
 * One of the home scope chips (All · Saved · Lists · Nearby): a 44px pill,
 * glossy cobalt when active, grey-100 otherwise. A toggle, so it reports
 * `aria-pressed`.
 */
export function ScopePill({ active, icon = null, children, style, ...rest }: ScopePillProps) {
  const press = usePressable<HTMLButtonElement>(rest);
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        flex: '0 0 auto',
        height: 'var(--hit-min)',
        padding: '0 var(--sp-7)',
        borderRadius: 'var(--r-pill)',
        background: active ? 'var(--fill-primary)' : 'var(--surface-sunken-on-white)',
        color: active ? 'var(--text-on-brand)' : 'var(--text-primary)',
        boxShadow: 'var(--gloss-top)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-label)',
        lineHeight: 'var(--lh-label)',
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--tr-tight)',
        whiteSpace: 'nowrap',
        ...press.style,
        ...style,
      }}
    >
      {icon ? <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span> : null}
      {children}
    </button>
  );
}
