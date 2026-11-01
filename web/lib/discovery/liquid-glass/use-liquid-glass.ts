'use client';

import * as React from 'react';
import type { GlassRegistry, GlassTier } from '../glass';
import { LiquidGlass } from './liquid-glass';

const REDUCE_TRANSPARENCY_KEY = 'discovery.reduce-transparency';
/** Fired on `window` when the in-app setting changes, so a live map re-tiers at once. */
const REDUCE_TRANSPARENCY_EVENT = 'discovery:reduce-transparency';

/** iOS doesn't expose Reduce Transparency to the web, so it is also an in-app setting. */
export function readReduceTransparency(): boolean {
  try {
    return localStorage.getItem(REDUCE_TRANSPARENCY_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeReduceTransparency(on: boolean) {
  try {
    localStorage.setItem(REDUCE_TRANSPARENCY_KEY, on ? '1' : '0');
  } catch {
    /* storage unavailable (private mode, in-app browser): the choice lasts this visit */
  }
  window.dispatchEvent(new Event(REDUCE_TRANSPARENCY_EVENT));
}

function prefersOpaque(): boolean {
  return (
    window.matchMedia('(prefers-contrast: more)').matches ||
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches ||
    readReduceTransparency()
  );
}

/**
 * Owns the glass for one map. Starts frosted (no backdrop yet), turns
 * refractive once the map has the glass layer, and steps back down — for good
 * — if the device misses the frame budget or the GL context is lost. Opaque
 * when the reader asked for contrast or less transparency.
 */
export function useLiquidGlass(): {
  glass: LiquidGlass;
  registry: GlassRegistry;
  /** The map calls these as its GL frame comes and goes. */
  onBackdropReady: () => void;
  onBackdropLost: () => void;
} {
  const [degraded, setDegraded] = React.useState(false);
  const [backdrop, setBackdrop] = React.useState(false);
  const [opaque, setOpaque] = React.useState(false);
  const [glass] = React.useState(() => new LiquidGlass(() => setDegraded(true)));

  React.useEffect(() => {
    const queries = ['(prefers-contrast: more)', '(prefers-reduced-transparency: reduce)'].map((q) => window.matchMedia(q));
    const sync = () => setOpaque(prefersOpaque());
    sync();
    queries.forEach((q) => q.addEventListener('change', sync));
    window.addEventListener(REDUCE_TRANSPARENCY_EVENT, sync);
    return () => {
      queries.forEach((q) => q.removeEventListener('change', sync));
      window.removeEventListener(REDUCE_TRANSPARENCY_EVENT, sync);
    };
  }, []);

  const tier: GlassTier = opaque ? 'solid' : backdrop && !degraded ? 'refractive' : 'frosted';
  const registry = React.useMemo(() => glass.registry(tier), [glass, tier]);

  return {
    glass,
    registry,
    onBackdropReady: React.useCallback(() => setBackdrop(true), []),
    onBackdropLost: React.useCallback(() => setBackdrop(false), []),
  };
}
