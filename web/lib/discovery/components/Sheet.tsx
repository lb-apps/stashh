'use client';

import * as React from 'react';

type SheetProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style' | 'title'> & {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  grabber?: boolean;
  padding?: number | string;
  style?: React.CSSProperties;
};

export function Sheet({ children, title, subtitle, onClose, grabber = true, padding = 'var(--gutter)', style, ...rest }: SheetProps) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface-card)',
        borderTopLeftRadius: 'var(--r-sheet)',
        borderTopRightRadius: 'var(--r-sheet)',
        boxShadow: 'var(--sh-sheet)',
        padding: `0 ${typeof padding === 'number' ? padding + 'px' : padding} 28px`,
        ...style,
      }}
      {...rest}
    >
      {grabber ? (
        <div style={{ display: 'grid', placeItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <span style={{ width: 'var(--grabber-w)', height: 'var(--grabber-h)', borderRadius: 'var(--r-pill)', background: 'var(--grey-300)' }} />
        </div>
      ) : null}
      {onClose ? (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20, width: 40, height: 40,
            display: 'grid', placeItems: 'center', border: 'none', padding: 0,
            borderRadius: 'var(--r-circle)', background: 'var(--grey-300)',
            color: 'var(--white)', cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      ) : null}
      {title ? (
        <div style={{ paddingTop: 8, paddingRight: onClose ? 52 : 0 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--fs-display-1)', lineHeight: 'var(--lh-display-1)', fontWeight: 'var(--fw-black)', letterSpacing: 'var(--tr-display)', color: 'var(--text-primary)' }}>
            {title}
          </h2>
          {subtitle ? (
            <div style={{ marginTop: 8, fontFamily: 'var(--font-text)', fontSize: 'var(--fs-body-lg)', lineHeight: 'var(--lh-body-lg)', color: 'var(--text-secondary)' }}>{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
