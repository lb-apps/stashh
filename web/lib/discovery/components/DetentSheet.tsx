'use client';

import * as React from 'react';
import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, type PanInfo } from 'motion/react';
import { lengthToken, motionToken } from '../token-values';
import { useElementSize } from '../use-element-size';

export type Detent = 'peek' | 'full';

type DetentSheetProps = {
  /** Controlled detent. */
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
  /** Visible height at the peek detent, given the container height. */
  peekHeight: (containerHeight: number) => number;
  /** Dragging well below peek calls this; without it the sheet can't be dismissed. */
  onDismiss?: () => void;
  /** Reports how much of the container the sheet covers, every frame — the map pads its camera with it. */
  onCoverChange?: (coveredPx: number) => void;
  /** The drag zone: grabber + whatever header the screen puts under it. */
  header?: React.ReactNode;
  /** Pinned under the content, above the home indicator — one primary action. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  'aria-label'?: string;
};

/**
 * Discovery's bottom sheet with detents, for screens over a live map.
 *
 * It moves only from its header (the grabber zone), so a scroll or a map pan
 * never turns into a sheet drag — and at the peek detent the whole sheet is a
 * handle, as in iOS, until it is pulled to full height and its content scrolls.
 * Releases snap to the nearest detent after projecting the flick velocity,
 * animated with Discovery's sheet tokens (`--dur-sheet`, `--ease-spring`).
 */
export function DetentSheet({
  detent,
  onDetentChange,
  peekHeight,
  onDismiss,
  onCoverChange,
  header,
  footer,
  children,
  'aria-label': ariaLabel,
}: DetentSheetProps) {
  const [containerRef, container] = useElementSize<HTMLDivElement>();
  const controls = useDragControls();
  const y = useMotionValue(typeof window === 'undefined' ? 0 : window.innerHeight);

  const height = container?.height ?? 0;
  const topInset = lengthToken('--sheet-top-inset');
  const offsets = React.useMemo(
    () => ({ full: topInset, peek: Math.max(topInset, height - peekHeight(height)) }),
    [height, peekHeight, topInset],
  );

  useMotionValueEvent(y, 'change', (latest) => onCoverChange?.(Math.max(0, height - latest)));

  // The detent is controlled: follow it (and the container size) with the sheet token.
  React.useEffect(() => {
    if (!container) return;
    const { duration, ease } = motionToken('--dur-sheet', '--ease-spring');
    const controlsAnim = animate(y, offsets[detent], { duration, ease });
    return () => controlsAnim.stop();
  }, [container, detent, offsets, y]);

  const startDrag = (event: React.PointerEvent) => controls.start(event, { distanceThreshold: 4 });

  const settle = (_: unknown, info: PanInfo) => {
    // Where the flick would carry the sheet within ~a fifth of a second.
    const projected = y.get() + info.velocity.y * 0.2;
    if (onDismiss && projected > offsets.peek + (height - offsets.peek) / 2) {
      onDismiss();
      return;
    }
    const next: Detent = Math.abs(projected - offsets.full) < Math.abs(projected - offsets.peek) ? 'full' : 'peek';
    if (next === detent) {
      const { duration, ease } = motionToken('--dur-sheet', '--ease-spring');
      animate(y, offsets[next], { duration, ease });
    } else {
      onDetentChange(next);
    }
  };

  const full = detent === 'full';

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <motion.section
        aria-label={ariaLabel}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: offsets.full, bottom: onDismiss ? height : offsets.peek }}
        dragElastic={{ top: 0.08, bottom: onDismiss ? 0.5 : 0.08 }}
        dragMomentum={false}
        onDragEnd={settle}
        style={{
          y,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: Math.max(0, height - offsets.full),
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
          background: 'var(--surface-card)',
          borderTopLeftRadius: 'var(--r-sheet)',
          borderTopRightRadius: 'var(--r-sheet)',
          boxShadow: 'var(--sh-sheet)',
          visibility: container ? 'visible' : 'hidden',
        }}
      >
        <div onPointerDown={startDrag} style={{ flex: '0 0 auto', touchAction: 'none', cursor: 'grab' }}>
          <div style={{ display: 'grid', placeItems: 'center', paddingTop: 'var(--sp-5)', paddingBottom: 'var(--sp-3)' }}>
            <span
              aria-hidden="true"
              style={{ width: 'var(--grabber-w)', height: 'var(--grabber-h)', borderRadius: 'var(--r-pill)', background: 'var(--grey-300)' }}
            />
          </div>
          {header}
        </div>
        <div
          onPointerDown={full ? undefined : startDrag}
          className="ds-scroll-hide"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: full ? 'auto' : 'hidden',
            overscrollBehavior: 'contain',
            touchAction: full ? 'pan-y' : 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {children}
        </div>
        {footer ? (
          <div
            style={{
              flex: '0 0 auto',
              paddingTop: 'var(--sp-6)',
              paddingInline: 'var(--gutter)',
              paddingBottom: 'max(env(safe-area-inset-bottom), var(--sp-7))',
            }}
          >
            {footer}
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}
