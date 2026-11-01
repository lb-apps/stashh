'use client';

import * as React from 'react';
import { glassStyle, useGlass } from '../glass';

type Shape = 'capsule' | 'circle' | 'card';

const RADIUS: Record<Shape, string> = {
  capsule: 'var(--r-pill)',
  circle: 'var(--r-circle)',
  card: 'var(--r-card)',
};

type GlassSurfaceProps = Omit<React.ComponentPropsWithoutRef<'div'>, 'style'> & {
  shape?: Shape;
  style?: React.CSSProperties;
};

/** A static pane of glass — the area title card, banners. */
export function GlassSurface({ shape = 'card', style, children, ...rest }: GlassSurfaceProps) {
  const { ref, tier } = useGlass<HTMLDivElement>();
  return (
    <div ref={ref} style={{ borderRadius: RADIUS[shape], color: 'var(--text-primary)', ...glassStyle(tier), ...style }} {...rest}>
      {children}
    </div>
  );
}

type GlassButtonProps = Omit<React.ComponentPropsWithoutRef<'button'>, 'style'> & {
  shape?: Exclude<Shape, 'card'>;
  /** Accessible name for icon-only buttons. */
  label?: string;
  style?: React.CSSProperties;
};

/**
 * A glass control. It flexes on press like gel (Discovery's press scale) and,
 * on the refractive tier, the glass lights up under the finger.
 */
export function GlassButton({ shape = 'capsule', label, style, children, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, ...rest }: GlassButtonProps) {
  const { ref, tier, registry } = useGlass<HTMLButtonElement>();
  const [pressed, setPressed] = React.useState(false);

  const release = (event: React.PointerEvent<HTMLButtonElement>) => {
    setPressed(false);
    registry.press(event.currentTarget, null);
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onPointerDown={(event) => {
        setPressed(true);
        registry.press(event.currentTarget, { x: event.clientX, y: event.clientY });
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        release(event);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        release(event);
        onPointerCancel?.(event);
      }}
      onPointerLeave={(event) => {
        if (pressed) release(event);
        onPointerLeave?.(event);
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-3)',
        minWidth: 'var(--hit-min)',
        minHeight: 'var(--hit-min)',
        padding: shape === 'circle' ? 0 : '0 var(--sp-7)',
        border: 'none',
        borderRadius: RADIUS[shape],
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--fs-caption)',
        fontWeight: 'var(--fw-semibold)',
        letterSpacing: 'var(--tr-tight)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transform: pressed ? 'scale(var(--press-scale-tight))' : 'scale(1)',
        transition: 'transform var(--dur-fast) var(--ease-spring)',
        WebkitTapHighlightColor: 'transparent',
        ...glassStyle(tier),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
