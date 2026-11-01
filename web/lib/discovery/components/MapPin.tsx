'use client';

import * as React from 'react';
import { categoryColor, type PlaceCategory } from '../categories';

/** Pin geometry in px — shared with the map's GL pin images, which must match. */
export const MAP_PIN = { disc: 44, discSelected: 56, ring: 3, ringSelected: 4, glyph: 20, glyphSelected: 24 } as const;

type MapPinProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  category?: PlaceCategory;
  glyph?: React.ReactNode;
  label?: React.ReactNode;
  selected?: boolean;
  count?: number | null;
  style?: React.CSSProperties;
};

export function MapPin({ category = 'default', glyph = null, label, selected = false, count, style, ...rest }: MapPinProps) {
  const d = selected ? MAP_PIN.discSelected : MAP_PIN.disc;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 5, ...style }} {...rest}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: d,
            height: d,
            borderRadius: 'var(--r-circle)',
            background: categoryColor(category),
            display: 'grid',
            placeItems: 'center',
            color: 'var(--white)',
            boxShadow: selected
              ? `0 0 0 ${MAP_PIN.ringSelected}px var(--white), 0 0 0 ${MAP_PIN.ringSelected + 3}px var(--cobalt-500), var(--sh-pin)`
              : `0 0 0 ${MAP_PIN.ring}px var(--white), var(--sh-pin)`,
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
