'use client';

import * as React from 'react';
import { categoryColor, categoryGradient, type PlaceCategory } from '../categories';

/** Orbs smaller than this are chip-scale: softer shading and no cast shadow. */
const CHIP_SCALE = 30;

type CategoryOrbProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style'> & {
  category: PlaceCategory;
  /** Diameter in px. */
  size: number;
  style?: React.CSSProperties;
};

/**
 * A place category as a glossy 3D ball — GlossyObject's orb recipe tinted by
 * the category's pin colour. The glyph (children) sits centred in white.
 * Decorative by default: the category is always named in text beside it.
 */
export function CategoryOrb({ category, size, style, children, ...rest }: CategoryOrbProps) {
  const chip = size < CHIP_SCALE;
  const px = (k: number) => `${(size * k).toFixed(1)}px`;
  // Shading is pure white/black alpha — light and shade on the ball, not
  // colour — the same way --gloss-* is expressed in elevation.css.
  const shading = [
    `inset 0 -${px(0.06)} ${px(0.2)} rgba(0, 0, 0, ${chip ? 0.16 : 0.3})`,
    `inset 0 ${px(0.035)} ${px(0.08)} rgba(255, 255, 255, ${chip ? 0.45 : 0.65})`,
  ];
  if (!chip) shading.push('var(--sh-pin)');

  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width: size,
        height: size,
        borderRadius: 'var(--r-circle)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--white)',
        background: `radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.14) 22%, rgba(255, 255, 255, 0) 46%), ${categoryGradient(category)}, ${categoryColor(category)}`,
        boxShadow: shading.join(', '),
        ...style,
      }}
      {...rest}
    >
      {/* specular highlight — a soft white catchlight, top-left */}
      <span
        style={{
          position: 'absolute',
          top: '12%',
          left: '22%',
          width: '28%',
          height: '17%',
          borderRadius: 'var(--r-circle)',
          background: 'rgba(255, 255, 255, 0.55)',
          filter: `blur(${Math.max(1, size * 0.06).toFixed(1)}px)`,
          pointerEvents: 'none',
        }}
      />
      {children}
    </span>
  );
}
