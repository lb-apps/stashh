'use client';

import * as React from 'react';

/** Avatar · name (+ inline badge) · one micro-label line · exactly one action. */
type ListRowProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'title'> & {
  leading?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'plain' | 'card' | 'sunken';
  style?: React.CSSProperties;
};

export function ListRow({
  leading,
  title,
  badge = null,
  meta,
  action = null,
  onClick,
  tone = 'plain',
  style,
  ...rest
}: ListRowProps) {
  const tones: Record<string, React.CSSProperties> = {
    plain: { background: 'transparent', boxShadow: 'none' },
    card: { background: 'var(--surface-card)', boxShadow: 'var(--sh-card)' },
    sunken: { background: 'var(--surface-sunken)', boxShadow: 'none' },
  };
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        minHeight: 'var(--list-row-h)',
        padding: tone === 'plain' ? '10px 0' : '10px 14px',
        borderRadius: tone === 'plain' ? 0 : 'var(--r-card-lg)',
        cursor: onClick ? 'pointer' : 'default',
        ...(tones[tone] || tones.plain),
        ...style,
      }}
      {...rest}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-title-2)',
              lineHeight: 'var(--lh-title-2)',
              fontWeight: 'var(--fw-semibold)',
              letterSpacing: 'var(--tr-title)',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          {badge}
        </div>
        {meta ? (
          <div
            style={{
              marginTop: 2,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-micro)',
              lineHeight: 'var(--lh-micro)',
              fontWeight: 'var(--fw-bold)',
              letterSpacing: 'var(--tr-micro)',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
