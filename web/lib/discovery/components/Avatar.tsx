'use client';

import * as React from 'react';

const SIZES: Record<string, number> = { xs: 28, sm: 36, md: 48, lg: 60, xl: 76 };

function initials(name = ''): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

type AvatarProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  badge?: React.ReactNode;
  style?: React.CSSProperties;
};

export function Avatar({ src, name = '', size = 'md', ring = false, badge = null, style, ...rest }: AvatarProps) {
  const d = SIZES[size] || SIZES.md;
  return (
    <div style={{ position: 'relative', width: d, height: d, flex: '0 0 auto', ...style }} {...rest}>
      <div
        style={{
          width: d,
          height: d,
          borderRadius: 'var(--r-circle)',
          overflow: 'hidden',
          background: 'var(--bone-50)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: ring
            ? '0 0 0 3px var(--white), 0 0 0 6px var(--cobalt-500), var(--sh-card)'
            : 'var(--sh-card)',
        }}
      >
        {src ? (
          <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: Math.round(d * 0.36),
              fontWeight: 'var(--fw-black)',
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
            }}
          >
            {initials(name)}
          </span>
        )}
      </div>
      {badge ? (
        <div style={{ position: 'absolute', right: -2, bottom: -2, lineHeight: 0 }}>{badge}</div>
      ) : null}
    </div>
  );
}
