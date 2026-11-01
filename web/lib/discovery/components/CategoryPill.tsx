'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PlaceCategory } from '../categories';
import { CategoryOrb } from './CategoryOrb';
import { Glyph } from './Glyph';
import { TEXT_SECONDARY_STRONG } from '../pending-tokens';
import { BUTTON_RESET, usePressable } from '../use-pressable';

/** Pill height (clears --hit-min) and its chip-scale orb, in px. */
const PILL_H = 46;
const ORB = 26;
const ORB_GLYPH = 14;

type CategoryPillProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style' | 'children'> & {
  category: PlaceCategory;
  icon: LucideIcon;
  label: React.ReactNode;
  /** Pre-formatted count of places in the category. */
  count?: React.ReactNode;
  style?: React.CSSProperties;
};

/** A "Browse by type" pill: small category orb, the category's name, its count. */
export function CategoryPill({ category, icon, label, count, style, ...rest }: CategoryPillProps) {
  const press = usePressable<HTMLButtonElement>(rest);
  return (
    <button
      type="button"
      {...rest}
      {...press.handlers}
      style={{
        ...BUTTON_RESET,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        flex: '0 0 auto',
        height: PILL_H,
        padding: '0 var(--sp-7) 0 var(--sp-4)',
        borderRadius: 'var(--r-pill)',
        background: 'var(--surface-sunken-on-white)',
        whiteSpace: 'nowrap',
        ...press.style,
        ...style,
      }}
    >
      <CategoryOrb category={category} size={ORB}>
        <Glyph icon={icon} size={ORB_GLYPH} />
      </CategoryOrb>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-body)',
          lineHeight: 'var(--lh-label)',
          fontWeight: 'var(--fw-bold)',
          letterSpacing: 'var(--tr-tight)',
          color: 'var(--text-primary)',
        }}
      >
        {label}
      </span>
      {count != null ? (
        <span
          style={{
            fontFamily: 'var(--font-rounded)',
            fontSize: 'var(--fs-caption)',
            lineHeight: 'var(--lh-caption)',
            fontWeight: 'var(--fw-heavy)',
            fontVariantNumeric: 'tabular-nums',
            color: TEXT_SECONDARY_STRONG,
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
