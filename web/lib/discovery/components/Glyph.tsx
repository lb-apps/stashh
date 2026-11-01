'use client';

import * as React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

type GlyphProps = Omit<LucideProps, 'ref'> & {
  /** A named Lucide import, e.g. `import { Search } from 'lucide-react'`. */
  icon: LucideIcon;
  size?: number;
};

/**
 * `Icon`, for bundle-sensitive surfaces: takes the Lucide component itself, so
 * only the glyphs a screen uses ship (`Icon` looks names up in Lucide's full
 * map). Same rule: stroke `--stroke-icon` (2.25), never varied.
 */
export function Glyph({ icon: Cmp, size = 20, strokeWidth = 2.25, ...rest }: GlyphProps) {
  return (
    <Cmp
      aria-hidden="true"
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: '0 0 auto', display: 'block' }}
      {...rest}
    />
  );
}
