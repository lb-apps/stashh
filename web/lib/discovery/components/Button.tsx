'use client';

import * as React from 'react';
import { TEXT_DANGER_STRONG } from '../pending-tokens';

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

type ButtonLook = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'onBrand';
  size?: 'sm' | 'md' | 'lg';
  shape?: 'rounded' | 'pill';
  fullWidth?: boolean;
};

/** The Button spec as styles — shared by `Button` and `ButtonLink`. */
function buttonStyle({ variant = 'primary', size = 'md', shape = 'rounded', fullWidth = false }: ButtonLook, pressed: boolean, disabled: boolean): React.CSSProperties {
  const s = SIZES[size] || SIZES.md;

  const base: React.CSSProperties = {
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
    textDecoration: 'none',
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
    danger: { background: 'var(--fill-secondary)', color: TEXT_DANGER_STRONG, boxShadow: 'var(--gloss-top)' },
    onBrand: {
      background: 'var(--white)',
      color: 'var(--cobalt-500)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    },
  };

  return { ...base, ...(variants[variant] || variants.primary) };
}

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
  const [pressed, setPressed] = React.useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...buttonStyle({ variant, size, shape, fullWidth }, pressed, disabled), ...style }}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

type ButtonLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'style'> &
  ButtonLook & {
    href: string;
    leadingIcon?: React.ReactNode;
    trailingIcon?: React.ReactNode;
    style?: React.CSSProperties;
  };

/** A Button that navigates: an `<a>` drawn to the same spec. */
export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  fullWidth = false,
  leadingIcon = null,
  trailingIcon = null,
  style,
  ...rest
}: ButtonLinkProps) {
  const [pressed, setPressed] = React.useState(false);

  return (
    <a
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{ ...buttonStyle({ variant, size, shape, fullWidth }, pressed, false), ...style }}
      {...rest}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </a>
  );
}
