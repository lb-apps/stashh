'use client';

import * as React from 'react';

type BadgeProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style'> & {
  tone?: 'cobalt' | 'cobaltSoft' | 'amber' | 'amberSoft' | 'grey' | 'onBrand';
  style?: React.CSSProperties;
};

export function Badge({ children, tone = 'cobalt', style, ...rest }: BadgeProps) {
  const tones: Record<string, React.CSSProperties> = {
    cobalt: { background: 'var(--cobalt-500)', color: 'var(--white)' },
    cobaltSoft: { background: 'var(--cobalt-100)', color: 'var(--cobalt-600)' },
    amber: { background: 'var(--amber-500)', color: 'var(--ink)' },
    amberSoft: { background: 'var(--amber-100)', color: '#8A6100' },
    grey: { background: 'var(--grey-300)', color: 'var(--grey-800)' },
    onBrand: { background: 'rgba(255,255,255,0.22)', color: 'var(--white)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 8px',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-nano)',
        lineHeight: 1,
        fontWeight: 'var(--fw-heavy)',
        letterSpacing: 'var(--tr-nano)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        boxShadow: 'var(--gloss-top)',
        verticalAlign: 'middle',
        ...(tones[tone] || tones.cobalt),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
