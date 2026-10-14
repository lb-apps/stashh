'use client';

import * as React from 'react';

type MicroLabelProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  tone?: 'tertiary' | 'secondary' | 'primary' | 'cobalt' | 'open' | 'onBrand';
  as?: React.ElementType;
  style?: React.CSSProperties;
};

export function MicroLabel({ children, tone = 'tertiary', as = 'div', style, ...rest }: MicroLabelProps) {
  const tones: Record<string, string> = {
    tertiary: 'var(--text-tertiary)',
    secondary: 'var(--text-secondary)',
    primary: 'var(--text-primary)',
    cobalt: 'var(--cobalt-500)',
    open: 'var(--text-open)',
    onBrand: 'rgba(255,255,255,0.72)',
  };
  const Tag = as as React.ElementType;
  return (
    <Tag
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-micro)',
        lineHeight: 'var(--lh-micro)',
        fontWeight: 'var(--fw-bold)',
        letterSpacing: 'var(--tr-micro)',
        textTransform: 'uppercase',
        color: tones[tone] || tones.tertiary,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
