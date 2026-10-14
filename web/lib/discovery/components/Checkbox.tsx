'use client';

import * as React from 'react';

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style' | 'onChange'> & {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  style?: React.CSSProperties;
};

export function Checkbox({ checked = false, onChange, disabled = false, label, style, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange && onChange(!checked)}
      style={{
        width: 36,
        height: 36,
        flex: '0 0 auto',
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: 'none',
        borderRadius: 'var(--r-sm)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: checked ? 'var(--fill-selected)' : 'var(--bone-200)',
        boxShadow: checked ? 'var(--gloss-top-strong)' : 'inset 0 1px 3px rgba(28,25,20,0.08)',
        color: 'var(--white)',
        transform: checked ? 'scale(1)' : 'scale(0.94)',
        transition: 'background var(--dur-fast) var(--ease-out), transform var(--dur) var(--ease-spring)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      {...rest}
    >
      {checked ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : null}
    </button>
  );
}
