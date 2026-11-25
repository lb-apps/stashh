'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { TEXT_SECONDARY_STRONG } from '../pending-tokens';
import { motionToken } from '../token-values';

/** How long a toast stays up, in ms: long enough to read two short lines. */
const DEFAULT_DURATION = 4000;
/** How far the toast drops in from, in px, and the scale it grows from. */
const ENTER_Y = -24;
const ENTER_SCALE = 0.92;

export type ToastMessage = {
  /** A new id is a new toast: it replaces the one showing and restarts the clock. */
  id: string | number;
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** A mark before the text — a small glossy object or a glyph. Decorative. */
  leading?: React.ReactNode;
};

type ToastProps = {
  /** What to say now; null says nothing. */
  message: ToastMessage | null;
  /** Called once `message` has been up for `duration`. */
  onDismiss: () => void;
  duration?: number;
  /** Placement: the region spans the top of its positioned parent, under the safe area. */
  style?: React.CSSProperties;
};

/**
 * A short note that drops in at the top of the screen and leaves on its own:
 * something just happened that needs no answer ("You earned 3 credits"). A
 * white floating pill, the one floating surface on the screen. It springs in
 * with a slight overshoot and leaves faster than it came; under reduced motion
 * it only fades. The region is always mounted and polite, so screen readers
 * read each message as it arrives. One at a time — the caller queues the rest,
 * and the next one drops in once the last has gone.
 */
export function Toast({ message, onDismiss, duration = DEFAULT_DURATION, style }: ToastProps) {
  const reduceMotion = useReducedMotion();
  const dismiss = React.useEffectEvent(onDismiss);
  const id = message?.id;

  // The clock is a timer outside React; it restarts for each new message.
  React.useEffect(() => {
    if (id === undefined) return;
    const timer = window.setTimeout(() => dismiss(), duration);
    return () => window.clearTimeout(timer);
  }, [id, duration]);

  const enter = motionToken('--dur-slow', '--ease-spring');
  const leave = motionToken('--dur-fast', '--ease-out');
  const away = reduceMotion ? { opacity: 0 } : { opacity: 0, y: ENTER_Y, scale: ENTER_SCALE };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + var(--sp-4))',
        insetInline: 'var(--gutter)',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <AnimatePresence mode="wait">
        {message ? (
          <motion.div
            key={message.id}
            initial={away}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: enter.duration, ease: enter.ease } }}
            exit={{ ...away, transition: { duration: leave.duration, ease: leave.ease } }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-6)',
              maxWidth: '100%',
              minHeight: 'var(--hit-min)',
              padding: message.leading ? 'var(--sp-4) var(--sp-9) var(--sp-4) var(--sp-4)' : 'var(--sp-5) var(--sp-9)',
              borderRadius: 'var(--r-pill)',
              background: 'var(--surface-card)',
              boxShadow: 'var(--sh-float)',
            }}
          >
            {message.leading ? (
              <span aria-hidden="true" style={{ display: 'flex', flex: '0 0 auto' }}>
                {message.leading}
              </span>
            ) : null}
            <span style={{ display: 'block', minWidth: 0 }}>
              <span className="ds-label" style={{ display: 'block', color: 'var(--text-primary)' }}>
                {message.title}
              </span>
              {message.sub ? (
                <span className="ds-caption" style={{ display: 'block', color: TEXT_SECONDARY_STRONG }}>
                  {message.sub}
                </span>
              ) : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
