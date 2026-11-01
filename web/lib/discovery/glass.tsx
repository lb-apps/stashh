'use client';

import * as React from 'react';

/**
 * Discovery's Liquid Glass material — how floating chrome is drawn over the map.
 *
 * Tiers, decided once by whoever owns the backdrop (the map):
 * - `refractive`: true lensing. The map renders each registered shape inside its
 *   own WebGL frame (refraction, specular rim, tint, gel merge, press glow);
 *   the DOM element is a transparent, accessible layer of glyphs on top.
 * - `frosted`: the classic material (`--material-chip` + `--material-blur`),
 *   where no WebGL backdrop exists or the GPU budget is missed.
 * - `solid`: opaque white — Reduce Transparency, Increase Contrast.
 *
 * Components never pick a tier; they register their element and render the
 * tier they are given.
 */
export type GlassTier = 'refractive' | 'frosted' | 'solid';

export interface GlassRegistry {
  tier: GlassTier;
  /** Adds an element to the glass frame; returns the cleanup. */
  register: (element: HTMLElement) => () => void;
  /** Lights the glass from inside under the finger (`null` releases it). */
  press: (element: HTMLElement, point: { x: number; y: number } | null) => void;
}

const FROSTED: GlassRegistry = { tier: 'frosted', register: () => () => {}, press: () => {} };

const GlassContext = React.createContext<GlassRegistry>(FROSTED);

export function GlassProvider({ value, children }: { value: GlassRegistry; children: React.ReactNode }) {
  return <GlassContext value={value}>{children}</GlassContext>;
}

export function useGlassRegistry(): GlassRegistry {
  return React.use(GlassContext);
}

/** Surface styles of each tier — the only place glass is styled. */
export function glassStyle(tier: GlassTier): React.CSSProperties {
  switch (tier) {
    case 'refractive':
      return { background: 'transparent', boxShadow: 'none' };
    case 'solid':
      return { background: 'var(--surface-card)', boxShadow: 'var(--sh-float)' };
    default:
      return {
        background: 'var(--material-chip)',
        backdropFilter: 'var(--material-blur)',
        WebkitBackdropFilter: 'var(--material-blur)',
        boxShadow: 'var(--gloss-top), var(--sh-float)',
      };
  }
}

/** Registers `element` with the glass frame for as long as it is mounted. */
export function useGlass<T extends HTMLElement>(): { ref: React.RefCallback<T>; tier: GlassTier; registry: GlassRegistry } {
  const registry = useGlassRegistry();
  const cleanup = React.useRef<(() => void) | null>(null);
  const ref = React.useCallback(
    (node: T | null) => {
      cleanup.current?.();
      cleanup.current = node ? registry.register(node) : null;
    },
    [registry],
  );
  return { ref, tier: registry.tier, registry };
}
