'use client';

import * as React from 'react';

const CATEGORY: Record<string, string> = {
  coffee: 'var(--pin-coffee)',
  food: 'var(--pin-food)',
  bar: 'var(--pin-bar)',
  rooftop: 'var(--pin-rooftop)',
  sweets: 'var(--pin-sweets)',
  default: 'var(--pin-default)',
};

/** A saved place as a row: category disc, name, address, and one trailing value. */
export type PlaceCategory = 'coffee' | 'food' | 'bar' | 'rooftop' | 'sweets' | 'default';

type PlaceRowProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  name: React.ReactNode;
  address?: React.ReactNode;
  category?: PlaceCategory;
  glyph?: React.ReactNode;
  badge?: React.ReactNode;
  trailing?: React.ReactNode;
  saved?: boolean;
  compact?: boolean;
  style?: React.CSSProperties;
};

export function PlaceRow({
  name,
  address,
  category = 'default',
  glyph = null,
  badge = null,
  trailing = null,
  saved = false,
  compact = false,
  onClick,
  style,
  ...rest
}: PlaceRowProps) {
  const disc = compact ? 40 : 48;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 12 : 14,
        minHeight: compact ? 68 : 'var(--place-row-h)',
        padding: compact ? '12px 14px' : '14px 18px',
        borderRadius: 'var(--r-card-lg)',
        background: 'var(--surface-sunken)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <div
          style={{
            width: disc,
            height: disc,
            borderRadius: 'var(--r-circle)',
            background: CATEGORY[category] || CATEGORY.default,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--white)',
            boxShadow: 'var(--gloss-top), 0 4px 10px rgba(28,25,20,0.16)',
          }}
        >
          {glyph}
        </div>
        {saved ? (
          <span
            style={{
              position: 'absolute',
              right: -3,
              bottom: -3,
              width: 22,
              height: 22,
              borderRadius: 'var(--r-circle)',
              background: 'var(--cobalt-500)',
              boxShadow: '0 0 0 3px var(--surface-sunken)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--white)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z" /></svg>
          </span>
        ) : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: compact ? 'var(--fs-headline)' : 'var(--fs-title-2)',
              lineHeight: compact ? 'var(--lh-headline)' : 'var(--lh-title-2)',
              fontWeight: 'var(--fw-bold)',
              letterSpacing: 'var(--tr-title)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </span>
          {badge}
        </div>
        {address ? (
          <div
            style={{
              marginTop: 1,
              fontFamily: 'var(--font-text)',
              fontSize: compact ? 'var(--fs-caption)' : 'var(--fs-body)',
              lineHeight: compact ? 'var(--lh-caption)' : 'var(--lh-body)',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {address}
          </div>
        ) : null}
      </div>
      {trailing ? (
        <div style={{ fontFamily: 'var(--font-rounded)', fontSize: compact ? 'var(--fs-caption)' : 'var(--fs-headline)', fontWeight: 'var(--fw-black)', color: compact ? 'var(--text-secondary)' : 'var(--text-primary)', flex: '0 0 auto' }}>{trailing}</div>
      ) : null}
    </div>
  );
}
