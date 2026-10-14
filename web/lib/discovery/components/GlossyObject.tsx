'use client';

import * as React from 'react';

/**
 * The slot for Discovery's signature glossy 3D objects.
 *
 * Pass `src` with a real render (PNG/WebP with alpha) — that is always the
 * right answer. With no `src` it draws a neutral glossy orb in the requested
 * tint so a layout can be composed before the render exists. It is a
 * placeholder, not artwork: ship the render.
 */
type GlossyObjectProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  src?: string;
  alt?: string;
  size?: number;
  tint?: 'cobalt' | 'chrome' | 'acid' | 'magenta' | 'gold';
  floating?: boolean;
  style?: React.CSSProperties;
};

export function GlossyObject({ src, alt = '', size = 200, tint = 'cobalt', floating = true, style, ...rest }: GlossyObjectProps) {
  const tints: Record<string, string[]> = {
    cobalt: ['#8FB6FF', '#0138FF', '#0A1E7A'],
    chrome: ['#FFFFFF', '#D8D8DE', '#8A8A94'],
    acid: ['#EEFFB8', '#C6FF3D', '#5E8A00'],
    magenta: ['#FFB3D8', '#FF2D9B', '#8A0049'],
    gold: ['#FFF0BF', '#FFC53D', '#8A5B00'],
  };
  const [hi, mid, lo] = tints[tint] || tints.cobalt;

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...style }} {...rest}>
      <div
        style={{
          width: size,
          height: size,
          position: 'relative',
          animation: floating ? 'ds-float 5.5s var(--ease-in-out) infinite' : 'none',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 18px 26px rgba(28,25,20,0.22))' }}
          />
        ) : (
          <div
            aria-label={alt || 'glossy object placeholder'}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: `radial-gradient(circle at 32% 26%, ${hi} 0%, ${mid} 46%, ${lo} 100%)`,
              boxShadow: `inset 0 -${size * 0.06}px ${size * 0.14}px rgba(0,0,0,0.35), inset 0 ${size * 0.03}px ${size * 0.06}px rgba(255,255,255,0.65), 0 ${size * 0.1}px ${size * 0.16}px rgba(28,25,20,0.24)`,
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '11%',
                left: '20%',
                width: '34%',
                height: '22%',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.82)',
                filter: 'blur(2px)',
              }}
            />
          </div>
        )}
      </div>
      <style>{'@keyframes ds-float{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-10px) rotate(1.5deg)}}'}</style>
    </div>
  );
}
