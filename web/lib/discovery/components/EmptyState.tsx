'use client';

import * as React from 'react';

/** Utility-mode empty state: a glossy object, a headline, one grey helper line. */
type EmptyStateProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  object?: React.ReactNode;
  headline: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  style?: React.CSSProperties;
};

export function EmptyState({ object = null, headline, sub, action = null, style, ...rest }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '48px var(--gutter)',
        textAlign: 'center',
        ...style,
      }}
      {...rest}
    >
      {object}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-title-1)',
            lineHeight: 'var(--lh-title-1)',
            fontWeight: 'var(--fw-semibold)',
            letterSpacing: 'var(--tr-title)',
            color: 'var(--text-primary)',
            textWrap: 'balance',
          }}
        >
          {headline}
        </div>
        {sub ? (
          <div
            style={{
              marginTop: 6,
              fontFamily: 'var(--font-text)',
              fontSize: 'var(--fs-body-lg)',
              lineHeight: 'var(--lh-body-lg)',
              color: 'var(--text-secondary)',
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
