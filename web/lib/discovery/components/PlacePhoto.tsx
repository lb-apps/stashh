'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { categoryGradient, type PlaceCategory } from '../categories';
import { Glyph } from './Glyph';

/** The stand-in glyph is a watermark, not an icon: white at this opacity. */
const GLYPH_OPACITY = 0.5;

type PlacePhotoProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'style'> & {
  src?: string | null;
  /** Empty (the default) when the place is named beside the photo. */
  alt?: string;
  category: PlaceCategory;
  /** Drawn large and faint on the category gradient when there is no photo. */
  glyph?: LucideIcon;
  glyphSize?: number;
  width?: React.CSSProperties['width'];
  height?: React.CSSProperties['height'];
  aspectRatio?: React.CSSProperties['aspectRatio'];
  /** A radius token, e.g. `var(--r-field)`. */
  radius?: string;
  /** Lifts a free-standing photo with gloss and a float shadow; off inside a card. */
  raised?: boolean;
  style?: React.CSSProperties;
};

/**
 * A place's photo block. With `src`, the photo (lazy, async-decoded) over the
 * category gradient, which shows while it loads and stays if it fails. Without
 * one, the gradient and a faint category glyph. Overlays (orb, open chip) go
 * in as children, positioned by the caller; nothing here clips them. A span,
 * so it can sit inside a button.
 */
export function PlacePhoto({
  src,
  alt = '',
  category,
  glyph,
  glyphSize = 40,
  width = '100%',
  height,
  aspectRatio,
  radius = '0px',
  raised = false,
  style,
  children,
  ...rest
}: PlacePhotoProps) {
  // A broken URL (expired CDN link) falls back to the gradient. Keyed by the
  // URL, so a new `src` gets its own try without an effect.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const photo = src && src !== failedSrc ? src : null;

  return (
    <span
      style={{
        position: 'relative',
        flex: '0 0 auto',
        width,
        height,
        aspectRatio,
        borderRadius: radius,
        background: `${categoryGradient(category)}, var(--surface-card)`,
        display: 'grid',
        placeItems: 'center',
        color: 'var(--white)',
        boxShadow: raised ? 'var(--sh-float)' : undefined,
        ...style,
      }}
      {...rest}
    >
      {photo ? (
        <img
          src={photo}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(photo)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      ) : glyph ? (
        <span style={{ display: 'grid', opacity: GLYPH_OPACITY }}>
          <Glyph icon={glyph} size={glyphSize} />
        </span>
      ) : null}
      {raised ? (
        // The gloss sits above the photo, so it reads on the image too.
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', boxShadow: 'var(--gloss-top)', pointerEvents: 'none' }} />
      ) : null}
      {children}
    </span>
  );
}
