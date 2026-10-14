'use client';

import * as React from 'react';

const TONES: Record<string, React.CSSProperties> = {
  acid: { background: 'var(--art-acid)', color: 'var(--cobalt-500)' },
  magenta: { background: 'var(--art-magenta)', color: 'var(--white)' },
  yellow: { background: 'var(--art-yellow)', color: 'var(--ink)' },
  cobalt: { background: 'var(--cobalt-500)', color: 'var(--white)' },
  ink: { background: 'var(--ink)', color: 'var(--white)' },
};

type StickerProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style'> & {
  tone?: 'acid' | 'magenta' | 'yellow' | 'cobalt' | 'ink';
  angle?: number;
  style?: React.CSSProperties;
};

export function Sticker({ children, tone = 'acid', angle = -2, style, ...rest }: StickerProps) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px 4px',
        borderRadius: 4,
        transform: `rotate(${angle}deg)`,
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-title-2)',
        lineHeight: 1.15,
        fontWeight: 'var(--fw-heavy)',
        letterSpacing: 'var(--tr-title)',
        boxShadow: '0 2px 0 rgba(10,10,10,0.10)',
        ...(TONES[tone] || TONES.acid),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
