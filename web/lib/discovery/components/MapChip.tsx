'use client';

import * as React from 'react';

type MapChipProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style'> & {
  icon?: React.ReactNode;
  tone?: 'material' | 'solid' | 'cobalt';
  style?: React.CSSProperties;
};

export function MapChip({ children, icon = null, tone = 'material', onClick, style, ...rest }: MapChipProps) {
  const tones: Record<string, React.CSSProperties> = {
    material: { background: 'var(--material-chip)', backdropFilter: 'var(--material-blur)', WebkitBackdropFilter: 'var(--material-blur)', color: 'var(--text-secondary)' },
    solid: { background: 'var(--white)', color: 'var(--text-primary)' },
    cobalt: { background: 'var(--fill-primary)', color: 'var(--white)' },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 40,
        flex: '0 0 auto',
        padding: '0 16px',
        border: 'none',
        borderRadius: 'var(--r-pill)',
        boxShadow: tone === 'cobalt' ? 'var(--gloss-top), var(--sh-cobalt-sm)' : 'var(--sh-float)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-caption)',
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--tr-tight)',
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
        ...(tones[tone] || tones.material),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
