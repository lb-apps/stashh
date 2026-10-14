'use client';

import * as React from 'react';

const SIZES: Record<string, { h: number; px: number; fs: number; r: string; gap: number }> = {
  sm: { h: 36, px: 14, fs: 15, r: 'var(--r-button)', gap: 6 },
  md: { h: 48, px: 20, fs: 17, r: 'var(--r-button)', gap: 8 },
  lg: { h: 58, px: 26, fs: 19, r: 'var(--r-cta)', gap: 10 },
};

type ButtonProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBrand';
  size?: 'sm' | 'md' | 'lg';
  shape?: 'rounded' | 'pill';
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: React.CSSProperties;
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  fullWidth = false,
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  onClick,
  style,
  ...rest
}: ButtonProps) {
  const s = SIZES[size] || SIZES.md;
  const [pressed, setPressed] = React.useState(false);

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    height: s.h,
    minWidth: s.h,
    padding: `0 ${s.px}px`,
    width: fullWidth ? '100%' : undefined,
    border: 'none',
    borderRadius: shape === 'pill' ? 'var(--r-pill)' : s.r,
    fontFamily: 'var(--font-display)',
    fontSize: s.fs,
    fontWeight: 'var(--fw-semibold)',
    letterSpacing: 'var(--tr-tight)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transform: pressed && !disabled ? 'scale(var(--press-scale))' : 'scale(1)',
    transition: 'transform var(--dur-fast) var(--ease-spring), background var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
    WebkitTapHighlightColor: 'transparent',
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: pressed ? 'var(--fill-primary-press)' : 'var(--fill-primary)',
      color: 'var(--text-on-brand)',
      boxShadow: `var(--gloss-top), ${pressed ? 'var(--sh-cobalt-sm)' : 'var(--sh-cobalt)'}`,
    },
    secondary: {
      background: 'var(--fill-secondary)',
      color: 'var(--text-primary)',
      boxShadow: 'var(--gloss-top)',
    },
    ghost: { background: 'transparent', color: 'var(--text-primary)' },
    danger: { background: 'var(--fill-secondary)', color: 'var(--text-danger)', boxShadow: 'var(--gloss-top)' },
    onBrand: {
      background: 'var(--white)',
      color: 'var(--cobalt-500)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    },
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
