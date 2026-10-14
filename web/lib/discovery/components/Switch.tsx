'use client';

import * as React from 'react';

type SwitchProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style' | 'onChange'> & {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  label?: string;
  style?: React.CSSProperties;
};

export function Switch({ checked = false, onChange, disabled = false, label, style, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange && onChange(!checked)}
      style={{
        position: 'relative',
        width: 62,
        height: 38,
        flex: '0 0 auto',
        padding: 0,
        border: 'none',
        borderRadius: 'var(--r-pill)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: checked ? 'var(--fill-selected)' : 'var(--bone-300)',
        boxShadow: 'inset 0 1px 3px rgba(28,25,20,0.10)',
        transition: 'background var(--dur) var(--ease-out)',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 27 : 3,
          width: 32,
          height: 32,
          borderRadius: 'var(--r-circle)',
          background: 'var(--white)',
          boxShadow: 'var(--sh-thumb), var(--gloss-top-strong)',
          transition: 'left var(--dur) var(--ease-spring)',
        }}
      />
    </button>
  );
}
