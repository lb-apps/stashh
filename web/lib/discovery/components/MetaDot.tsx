'use client';

import * as React from 'react';

/** Dot diameter in px. */
const DOT = 3;

type MetaDotProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style' | 'children'> & {
  style?: React.CSSProperties;
};

/** The small separator dot between items on a meta line (rating · distance). Decorative. */
export function MetaDot({ style, ...rest }: MetaDotProps) {
  return (
    <span
      aria-hidden="true"
      style={{ display: 'block', flex: '0 0 auto', width: DOT, height: DOT, borderRadius: 'var(--r-circle)', background: 'var(--grey-300)', ...style }}
      {...rest}
    />
  );
}
