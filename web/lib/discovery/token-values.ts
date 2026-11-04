'use client';

/**
 * Discovery token values in JS — for what CSS can't animate: Motion-driven
 * gestures and the WebGL glass pass. CSS transitions
 * read `--dur-*` / `--ease-*` directly; gesture-driven animation needs the same
 * values as numbers, so they are read from the live tokens — never retyped.
 * The tokens already switch under `prefers-reduced-motion`, so callers get the
 * reduced variant for free.
 */
export type CubicBezier = [number, number, number, number];

export interface MotionToken {
  /** seconds */
  duration: number;
  ease: CubicBezier;
}

const FALLBACK: MotionToken = { duration: 0.22, ease: [0.22, 0.9, 0.28, 1] };

function readVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function parseDuration(value: string): number | null {
  const ms = /^([\d.]+)ms$/.exec(value);
  if (ms) return Number(ms[1]) / 1000;
  const s = /^([\d.]+)s$/.exec(value);
  return s ? Number(s[1]) : null;
}

function parseBezier(value: string): CubicBezier | null {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(value);
  if (!m) return null;
  const parts = m[1].split(',').map((n) => Number(n.trim()));
  return parts.length === 4 && parts.every((n) => !Number.isNaN(n)) ? (parts as CubicBezier) : null;
}

/** e.g. `motionToken('--dur-sheet', '--ease-spring')` */
export function motionToken(durationVar: string, easeVar: string): MotionToken {
  return {
    duration: parseDuration(readVar(durationVar)) ?? FALLBACK.duration,
    ease: parseBezier(readVar(easeVar)) ?? FALLBACK.ease,
  };
}

/** A length token (`--sp-9`, `--r-sheet`) in px. */
export function lengthToken(name: string): number {
  const n = Number.parseFloat(readVar(name));
  return Number.isNaN(n) ? 0 : n;
}

/** A unitless number token (`--glass-refraction`). */
export function numberToken(name: string, fallback = 0): number {
  const n = Number.parseFloat(readVar(name));
  return Number.isNaN(n) ? fallback : n;
}

/** A colour token as linear RGBA in 0–1 (`#RRGGBB`, `#RGB`, `rgb()`, `rgba()`). */
export function colorToken(name: string): [number, number, number, number] {
  const value = readVar(name);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1) as [number, number, number, number];
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
  if (rgb) {
    const [r, g, b, a = '1'] = rgb[1].split(/[\s,/]+/).filter(Boolean);
    return [Number(r) / 255, Number(g) / 255, Number(b) / 255, Number(a)];
  }
  return [0, 0, 0, 0];
}
