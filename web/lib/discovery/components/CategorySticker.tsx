'use client';

import * as React from 'react';
import { categoryColor, type PlaceCategory } from '../categories';

/** The white die-cut edge, in px. */
const RING = 3;
/** Stuck on slightly crooked, in degrees. */
const TILT = -4;
/** Corner radius as a share of the height. */
const RADIUS_RATIO = 0.34;

type CategoryStickerProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style'> & {
  category: PlaceCategory;
  /** Width and height in px: stickers are a little wider than tall. */
  width: number;
  height: number;
  style?: React.CSSProperties;
};

/**
 * A place category as a sticker on a photo: a glossy rounded tile in the
 * category's colour with a white die-cut edge, stuck on a few degrees crooked.
 * The glyph (children) sits centred in white. Decorative: the category is
 * always named in text beside it.
 */
export function CategorySticker({ category, width, height, style, children, ...rest }: CategoryStickerProps) {
  const c = categoryColor(category);
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width,
        height,
        borderRadius: Math.round(height * RADIUS_RATIO),
        display: 'grid',
        placeItems: 'center',
        color: 'var(--white)',
        background: `linear-gradient(152deg, color-mix(in srgb, ${c} 95%, transparent) 0%, ${c} 46%, color-mix(in srgb, ${c} 77%, transparent) 100%), ${c}`,
        boxShadow: `0 0 0 ${RING}px var(--white), var(--gloss-inner), var(--sh-pin)`,
        transform: `rotate(${TILT}deg)`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
