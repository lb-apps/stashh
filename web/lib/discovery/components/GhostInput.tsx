'use client';

import * as React from 'react';

type GhostInputProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'onChange' | 'prefix'> & {
  value?: string;
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  prefix?: React.ReactNode;
  size?: 'lg' | 'md';
  align?: 'center' | 'left';
  style?: React.CSSProperties;
};

export function GhostInput({
  value,
  placeholder = 'First name',
  onChange,
  prefix,
  size = 'lg',
  align = 'center',
  style,
  ...rest
}: GhostInputProps) {
  const fs = size === 'lg' ? 52 : 38;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: align === 'center' ? 'center' : 'flex-start', gap: 12, ...style }} {...rest}>
      {prefix ? (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: fs,
            fontWeight: 'var(--fw-semibold)',
            letterSpacing: 'var(--tr-display)',
            color: 'var(--text-primary)',
            borderBottom: '3px solid var(--text-primary)',
            lineHeight: 1.05,
          }}
        >
          {prefix}
        </span>
      ) : null}
      <input
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        style={{
          flex: align === 'center' ? '0 1 auto' : 1,
          width: align === 'center' ? `${Math.max((value || placeholder).length, 6)}ch` : '100%',
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
