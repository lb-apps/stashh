'use client';

import * as React from 'react';
import { TEXT_SECONDARY_STRONG } from '../pending-tokens';

type MicroLabelProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  tone?: 'tertiary' | 'secondary' | 'primary' | 'cobalt' | 'open' | 'onBrand';
  as?: React.ElementType;
  style?: React.CSSProperties;
};

/**
 * The uppercase micro label ("TODAY", "SAVED FROM"). The default `secondary`
 * tone clears 4.5:1 on white and on bone; `tertiary` is the lighter grey, for
 * labels that are decoration rather than text someone has to read.
 */
export function MicroLabel({ children, tone = 'secondary', as = 'div', style, ...rest }: MicroLabelProps) {
  const tones: Record<string, string> = {
    tertiary: 'var(--text-tertiary)',
    secondary: TEXT_SECONDARY_STRONG,
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
        color: tones[tone] || tones.secondary,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
