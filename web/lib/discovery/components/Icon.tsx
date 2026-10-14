'use client';

import * as React from 'react';
import { icons, type LucideProps } from 'lucide-react';

const pascal = (n: string) =>
  n.split(/[-_ ]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

export type IconName = keyof typeof icons | string;

type IconProps = Omit<LucideProps, 'ref' | 'name'> & {
  /** kebab-case or PascalCase Lucide name, e.g. "map-pin" or "MapPin". */
  name: IconName;
  size?: number;
};

/**
 * Discovery ships no icon binaries of its own — the iOS app draws SF Symbols,
 * which cannot be redistributed to the web, so Lucide at stroke-width 2.25
 * stands in. Stroke width is the token `--stroke-icon`; do not vary it.
 */
export function Icon({ name, size = 20, strokeWidth = 2.25, ...rest }: IconProps) {
  const Cmp = icons[pascal(String(name)) as keyof typeof icons];
  if (!Cmp) {
    return <span aria-hidden="true" style={{ display: 'inline-block', width: size, height: size }} />;
  }
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
