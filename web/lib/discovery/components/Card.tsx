'use client';

import * as React from 'react';

type CardProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  elevation?: 'none' | 'card' | 'lg' | 'float';
  padding?: number | string;
  radius?: number | string;
  tone?: 'white' | 'sunken' | 'sunkenOnWhite' | 'brand';
  style?: React.CSSProperties;
};

export function Card({ children, elevation = 'card', padding = 20, radius = 'var(--r-card)', tone = 'white', style, ...rest }: CardProps) {
  const tones: Record<string, React.CSSProperties> = {
    white: { background: 'var(--surface-card)' },
    sunken: { background: 'var(--surface-sunken)' },
    sunkenOnWhite: { background: 'var(--surface-sunken-on-white)' },
    brand: { background: 'var(--surface-brand)', color: 'var(--text-on-brand)' },
  };
  const shadows: Record<string, string> = { none: 'none', card: 'var(--sh-card)', lg: 'var(--sh-card-lg)', float: 'var(--sh-float)' };
  return (
    <div
      style={{
        borderRadius: radius,
        padding,
        boxShadow: shadows[elevation] ?? shadows.card,
        ...(tones[tone] || tones.white),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
