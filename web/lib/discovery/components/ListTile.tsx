'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PlaceCategory } from '../categories';
import { CategoryOrb } from './CategoryOrb';
import { Glyph } from './Glyph';
import { TEXT_SECONDARY_STRONG } from '../pending-tokens';
import { BUTTON_RESET, usePressable } from '../use-pressable';

/** Orb and glyph size in px. */
const ORB = 36;
const ORB_GLYPH = 18;

type ListTileProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style' | 'title' | 'children'> & {
  category: PlaceCategory;
  icon: LucideIcon;
  title: React.ReactNode;
  /** One grey line under the title ("12 spots"). */
  meta?: React.ReactNode;
  style?: React.CSSProperties;
};

/**
 * A list (or the "My spots" shortcut) as a half-width tile: category orb,
 * title, one meta line, on a grey-100 block. The whole tile is the button.
 */
export function ListTile({ category, icon, title, meta, style, ...rest }: ListTileProps) {
  const press = usePressable<HTMLButtonElement>(rest);
  return (
    <button
      type="button"
      {...rest}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-5)',
        width: '100%',
        minWidth: 0,
        minHeight: 'var(--hit-min)',
        padding: 'var(--sp-5) var(--sp-6)',
        borderRadius: 'var(--r-field)',
        background: 'var(--surface-sunken-on-white)',
        textAlign: 'left',
        ...press.style,
        ...style,
      }}
    >
      <CategoryOrb category={category} size={ORB}>
        <Glyph icon={icon} size={ORB_GLYPH} />
      </CategoryOrb>
      <span style={{ display: 'block', minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-body)',
            lineHeight: 'var(--lh-label)',
            fontWeight: 'var(--fw-bold)',
            letterSpacing: 'var(--tr-tight)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        {meta != null ? (
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-text)',
              fontSize: 'var(--fs-micro)',
              lineHeight: 'var(--lh-micro)',
              color: TEXT_SECONDARY_STRONG,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}
