'use client';

import * as React from 'react';
import { SIGN_FACE, TEXT_OPEN_STRONG } from '../pending-tokens';

/** Chip height in px — sized to sit on a photo corner. */
const CHIP_H = 23;
/** The miniature sign mark's drawing box. */
const MARK = { w: 14, h: 13 } as const;

type OpenChipProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style'> & {
  open: boolean;
  style?: React.CSSProperties;
};

/**
 * OpenSign at chip scale: the same candy face and gloss, with a miniature of
 * its hook and ropes so it reads as the same object. Children are the label
 * ("Open" / "Closed"), set in caps.
 */
export function OpenChip({ open, style, children, ...rest }: OpenChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        height: CHIP_H,
        padding: '0 var(--sp-5)',
        borderRadius: 'var(--r-pill)',
        background: open ? SIGN_FACE.open : SIGN_FACE.closed,
        color: open ? TEXT_OPEN_STRONG : 'var(--grey-800)',
        boxShadow: 'var(--gloss-top), var(--sh-thumb)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-nano)',
        lineHeight: 'var(--lh-nano)',
        fontWeight: 'var(--fw-heavy)',
        letterSpacing: 'var(--tr-nano)',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      <svg
        width={MARK.w}
        height={MARK.h}
        viewBox={`0 0 ${MARK.w} ${MARK.h}`}
        fill="none"
        aria-hidden="true"
        style={{ display: 'block', flex: '0 0 auto', opacity: 0.78 }}
      >
        <circle cx="7" cy="1.7" r="1.6" fill="currentColor" />
        <path d="M7 3.1 2.4 8.2M7 3.1l4.6 5.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="1.1" y="8.1" width="11.8" height="4.2" rx="2.1" fill="currentColor" />
      </svg>
      {children}
    </span>
  );
}
