'use client';

import * as React from 'react';

/** The hanging sign — a small glossy object that reports hours.
 * Built from CSS gradients so it scales; swap in a real 3D render via
 * GlossyObject when the moment deserves it. */
type OpenSignProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  open?: boolean;
  detail?: React.ReactNode;
  style?: React.CSSProperties;
};

export function OpenSign({ open = true, detail = 'until 9:00 PM', style, ...rest }: OpenSignProps) {
  const face = open
    ? 'linear-gradient(168deg, #E8FFE9 0%, #BEF3C8 52%, #9FE7B0 100%)'
    : 'linear-gradient(168deg, #F2F0EC 0%, #E4E0D9 52%, #D6D1C8 100%)';
  const ink = open ? 'var(--text-open)' : 'var(--text-tertiary)';
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...style }} {...rest}>
      <div style={{ position: 'relative', width: 92, height: 16 }}>
        <span style={{ position: 'absolute', left: '50%', top: 0, width: 9, height: 9, marginLeft: -4.5, borderRadius: '50%', background: 'var(--grey-300)', boxShadow: 'var(--gloss-top)' }} />
        <span style={{ position: 'absolute', left: 8, top: 4, width: 40, height: 3, borderRadius: 2, background: 'var(--grey-300)', transform: 'rotate(16deg)', transformOrigin: 'right center' }} />
        <span style={{ position: 'absolute', right: 8, top: 4, width: 40, height: 3, borderRadius: 2, background: 'var(--grey-300)', transform: 'rotate(-16deg)', transformOrigin: 'left center' }} />
        <span style={{ position: 'absolute', left: 4, top: 11, width: 7, height: 7, borderRadius: '50%', background: 'var(--grey-300)' }} />
        <span style={{ position: 'absolute', right: 4, top: 11, width: 7, height: 7, borderRadius: '50%', background: 'var(--grey-300)' }} />
      </div>
      <div
        style={{
          marginTop: -2,
          padding: '8px 20px 10px',
          borderRadius: 'var(--r-pill)',
          background: face,
          boxShadow: 'var(--gloss-inner), 0 8px 18px rgba(28,25,20,0.14)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontFamily: 'var(--font-rounded)', fontSize: 'var(--fs-headline)', fontWeight: 'var(--fw-black)', letterSpacing: '0.02em', color: ink, lineHeight: 1 }}>
          {open ? 'OPEN' : 'CLOSED'}
        </div>
        {detail ? (
          <div style={{ marginTop: 2, fontFamily: 'var(--font-rounded)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)', color: ink, opacity: 0.85, lineHeight: 1.2 }}>{detail}</div>
        ) : null}
      </div>
    </div>
  );
}
