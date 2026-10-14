'use client';

import * as React from 'react';

const SIZES: Record<string, number> = { sm: 36, md: 44, lg: 52, xl: 60 };

type IconButtonProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style'> & {
  variant?: 'floating' | 'ghost' | 'cobalt' | 'plain';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  label?: string;
  style?: React.CSSProperties;
};

export function IconButton({
  children,
  variant = 'floating',
  size = 'md',
  shape = 'circle',
  disabled = false,
  label,
  onClick,
  style,
  ...rest
}: IconButtonProps) {
  const d = SIZES[size] || SIZES.md;
  const [pressed, setPressed] = React.useState(false);

  const variants: Record<string, React.CSSProperties> = {
    floating: { background: 'var(--white)', color: 'var(--cobalt-500)', boxShadow: 'var(--sh-float)' },
    ghost: { background: 'var(--fill-secondary)', color: 'var(--text-tertiary)', boxShadow: 'none' },
    cobalt: {
      background: pressed ? 'var(--fill-primary-press)' : 'var(--fill-primary)',
      color: 'var(--white)',
      boxShadow: `var(--gloss-top), ${pressed ? 'var(--sh-cobalt-sm)' : 'var(--sh-cobalt)'}`,
    },
    plain: { background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none' },
  };

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: d,
        height: d,
        flex: '0 0 auto',
        border: 'none',
        padding: 0,
        borderRadius: shape === 'circle' ? 'var(--r-circle)' : 'var(--r-icon-sq)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transform: pressed && !disabled ? 'scale(var(--press-scale-tight))' : 'scale(1)',
        transition: 'transform var(--dur-fast) var(--ease-spring), box-shadow var(--dur-fast) var(--ease-out)',
        WebkitTapHighlightColor: 'transparent',
        ...(variants[variant] || variants.floating),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
