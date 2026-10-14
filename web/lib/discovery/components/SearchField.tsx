'use client';

import * as React from 'react';

type SearchFieldProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'onChange'> & {
  value?: string;
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onClear?: () => void;
  variant?: 'filled' | 'filledOnWhite' | 'floating';
  align?: 'left' | 'center';
  icon?: boolean;
  style?: React.CSSProperties;
};

export function SearchField({
  value,
  placeholder = 'Search for a place…',
  onChange,
  onClear,
  variant = 'filled',
  align = 'left',
  icon = true,
  style,
  ...rest
}: SearchFieldProps) {
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
        height: 56,
        padding: '0 18px',
        borderRadius: 'var(--r-pill)',
        ...(variants[variant] || variants.filled),
        ...style,
      }}
      {...rest}
    >
      {icon && (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="var(--stroke-icon)" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" />
        </svg>
      )}
      <input
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          background: 'transparent',
          outline: 'none',
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
          aria-label="Clear"
          onClick={onClear}
          style={{
            width: 24, height: 24, flex: '0 0 auto', display: 'grid', placeItems: 'center',
            border: 'none', borderRadius: 'var(--r-circle)',
            background: 'var(--grey-300)', color: 'var(--white)', cursor: 'pointer', padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      ) : null}
    </div>
  );
}
