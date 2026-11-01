'use client';

import * as React from 'react';

/** Solid star — Lucide's outline reads too thin at rating size. */
const STAR_PATH =
  'M12 2.6a.62.62 0 0 1 .56.35l2.44 4.95 5.46.8a.62.62 0 0 1 .35 1.06l-3.95 3.85.93 5.43a.62.62 0 0 1-.9.66L12 17.13l-4.89 2.57a.62.62 0 0 1-.9-.66l.93-5.43-3.95-3.85a.62.62 0 0 1 .35-1.06l5.46-.8 2.44-4.95A.62.62 0 0 1 12 2.6Z';

type RatingProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style' | 'children'> & {
  /** Pre-formatted for the locale ("4.6", "4,6"). */
  value: string;
  /** Star size in px. */
  size?: number;
  /** Spoken name ("Rated 4.6"); without it the bare numeral is read. */
  label?: string;
  style?: React.CSSProperties;
};

/** A rating: a solid amber star and a rounded black numeral. */
export function Rating({ value, size = 17, label, style, ...rest }: RatingProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-1)', flex: '0 0 auto', ...style }}
      {...rest}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--amber-500)" aria-hidden="true" style={{ display: 'block', flex: '0 0 auto' }}>
        <path d={STAR_PATH} />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-rounded)',
          fontSize: 'var(--fs-caption)',
          lineHeight: 'var(--lh-caption)',
          fontWeight: 'var(--fw-black)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </span>
    </span>
  );
}
