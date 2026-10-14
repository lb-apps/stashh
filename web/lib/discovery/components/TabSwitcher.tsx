'use client';

import * as React from 'react';

const optValue = (o: { value?: string } | string): string =>
  typeof o === 'string' ? o : (o.value ?? '');
const optLabel = (o: { label?: React.ReactNode; value?: string } | string): React.ReactNode =>
  typeof o === 'string' ? o : (o.label ?? o.value);


export type TabOption = string | { value: string; label?: React.ReactNode };

type TabSwitcherProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'onChange'> & {
  options?: TabOption[];
  value?: string;
  onChange?: (next: string) => void;
  style?: React.CSSProperties;
};

export function TabSwitcher({ options = [], value, onChange, style, ...rest }: TabSwitcherProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...style }} {...rest}>
      {options.map((o) => {
        const v = optValue(o);
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange && onChange(v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 44,
              padding: '0 20px',
              border: 'none',
              borderRadius: 'var(--r-pill)',
              background: active ? 'var(--white)' : 'transparent',
              boxShadow: active ? 'var(--sh-card)' : 'none',
              color: active ? 'var(--cobalt-500)' : 'var(--text-tertiary)',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-title-2)',
              fontWeight: active ? 'var(--fw-bold)' : 'var(--fw-medium)',
              letterSpacing: 'var(--tr-title)',
              cursor: 'pointer',
              transition: 'color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {optLabel(o)}
          </button>
        );
      })}
    </div>
  );
}
