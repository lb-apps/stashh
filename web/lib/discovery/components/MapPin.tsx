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

type MapPinProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  category?: 'coffee' | 'food' | 'bar' | 'rooftop' | 'sweets' | 'default';
  glyph?: React.ReactNode;
  label?: React.ReactNode;
  selected?: boolean;
  count?: number | null;
  style?: React.CSSProperties;
};

export function MapPin({ category = 'default', glyph = null, label, selected = false, count, style, ...rest }: MapPinProps) {
  const d = selected ? 56 : 44;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 5, ...style }} {...rest}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: d,
            height: d,
            borderRadius: 'var(--r-circle)',
            background: CATEGORY[category] || CATEGORY.default,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--white)',
            boxShadow: selected
              ? '0 0 0 4px var(--white), 0 0 0 7px var(--cobalt-500), var(--sh-pin)'
              : '0 0 0 3px var(--white), var(--sh-pin)',
            transform: selected ? 'scale(1)' : 'scale(1)',
            transition: 'width var(--dur) var(--ease-spring), height var(--dur) var(--ease-spring)',
          }}
        >
          {glyph}
        </div>
        {count != null ? (
          <span
            style={{
              position: 'absolute', top: -4, right: -8, minWidth: 22, height: 22, padding: '0 6px',
              borderRadius: 'var(--r-pill)', background: 'var(--cobalt-500)', color: 'var(--white)',
              display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px var(--white)',
              fontFamily: 'var(--font-rounded)', fontSize: 'var(--fs-nano)', fontWeight: 'var(--fw-black)',
            }}
          >
            {count}
          </span>
        ) : null}
      </div>
      {label ? (
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--white)',
            boxShadow: 'var(--sh-float)',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-nano)',
            fontWeight: 'var(--fw-heavy)',
            letterSpacing: 'var(--tr-nano)',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
