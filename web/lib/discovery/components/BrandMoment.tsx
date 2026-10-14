'use client';

import * as React from 'react';

/** A full-bleed cobalt screen: one glossy object, a centred two-line headline,
 * and at most one action. The screen commits to brand mode entirely. */
type BrandMomentProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  headline: React.ReactNode;
  sub?: React.ReactNode;
  object?: React.ReactNode;
  action?: React.ReactNode;
  align?: React.CSSProperties['textAlign'];
  style?: React.CSSProperties;
};

export function BrandMoment({ headline, sub, object = null, action = null, align = 'center', style, ...rest }: BrandMomentProps) {
  return (
    <div
      className="ds-mode-brand"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        minHeight: '100%',
        padding: '64px var(--gutter)',
        textAlign: align,
        ...style,
      }}
      {...rest}
    >
      {object}
      <div>
        <h1
          style={{
            margin: 0,
            maxWidth: 12 + 'em',
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-title-1)',
            lineHeight: 'var(--lh-title-1)',
            fontWeight: 'var(--fw-heavy)',
            letterSpacing: 'var(--tr-title)',
            color: 'var(--white)',
            textWrap: 'balance',
          }}
        >
          {headline}
        </h1>
        {sub ? (
          <p
            style={{
              margin: '12px 0 0',
              fontFamily: 'var(--font-text)',
              fontSize: 'var(--fs-body-lg)',
              lineHeight: 'var(--lh-body-lg)',
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            {sub}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
