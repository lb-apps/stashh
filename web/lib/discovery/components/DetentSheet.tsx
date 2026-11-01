'use client';

import * as React from 'react';
import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { lengthToken, motionToken } from '../token-values';
import { useElementSize } from '../use-element-size';
import { Glyph } from './Glyph';
import { IconButton } from './IconButton';

/** The grabber's padding above and below; together with the grabber they are the sheet's top row. */
const GRABBER_PAD = { top: 'var(--sp-5)', bottom: 'var(--sp-3)' } as const;
/** Where the close button sits: level with the header's first row, inset from the sheet's right edge. */
const CLOSE_INSET = {
  top: `calc(${GRABBER_PAD.top} + var(--grabber-h) + ${GRABBER_PAD.bottom})`,
  insetInlineEnd: 'var(--sp-7)',
} as const;
/** What a `SheetHeader` keeps clear on its right for the close button: its inset, its hit target, a gap. */
const CLOSE_CLEARANCE = `calc(${CLOSE_INSET.insetInlineEnd} + var(--hit-min) + var(--sp-4))`;

export type Detent = 'peek' | 'full';

type DetentSheetProps = {
  /** Controlled detent. */
  detent: Detent;
  onDetentChange: (detent: Detent) => void;
  /** Visible height at the peek detent, given the container height. */
  peekHeight: (containerHeight: number) => number;
  /** Dragging well below peek, or the close button, calls this; without it the sheet can't be dismissed. */
  onDismiss?: () => void;
  /** The close button's accessible name ("Close"), shown with `onDismiss`. */
  closeLabel?: string;
  /** Reports how much of the container the sheet covers, every frame — the map pads its camera with it. */
  onCoverChange?: (coveredPx: number) => void;
  /** The screen: `SheetHeader`, content, `SheetFooter`. */
  children?: React.ReactNode;
  'aria-label'?: string;
};

/**
 * Discovery's bottom sheet with detents, for screens over a live map.
 *
 * It moves only from its grabber and `SheetHeader`, so a scroll or a map pan
 * never turns into a sheet drag — and at the peek detent the whole sheet is a
 * handle, as in iOS, until it is pulled to full height and its content scrolls.
 * One sheet serves every screen: a screen renders `SheetHeader` (pinned, the
 * drag handle), its content, and optionally `SheetFooter` (pinned primary action).
 * Releases snap to the nearest detent after projecting the flick velocity,
 * animated with Discovery's sheet tokens (`--dur-sheet`, `--ease-spring`).
 * A dismissible sheet also gets one close button, pinned at the top right
 * beside the grabber, for anyone who can't drag; `SheetHeader` keeps clear of it.
 */
export function DetentSheet({
  detent,
  onDetentChange,
  peekHeight,
  onDismiss,
  closeLabel = 'Close',
  onCoverChange,
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
  const dismissible = Boolean(onDismiss);

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
        <div
          onPointerDown={startDrag}
          style={{ flex: '0 0 auto', display: 'grid', placeItems: 'center', paddingTop: GRABBER_PAD.top, paddingBottom: GRABBER_PAD.bottom, touchAction: 'none', cursor: 'grab' }}
        >
          <span
            aria-hidden="true"
            style={{ width: 'var(--grabber-w)', height: 'var(--grabber-h)', borderRadius: 'var(--r-pill)', background: 'var(--grey-300)' }}
          />
        </div>
        {onDismiss ? (
          <IconButton
            variant="plain"
            label={closeLabel}
            onClick={onDismiss}
            style={{
              position: 'absolute',
              ...CLOSE_INSET,
              zIndex: 2,
              background: 'var(--fill-secondary-on-white)',
              color: 'var(--grey-800)',
            }}
          >
            <Glyph icon={X} />
          </IconButton>
        ) : null}
        <SheetContext value={{ startDrag, detent, dismissible }}>
          <div
            onPointerDown={full ? undefined : startDrag}
            className="ds-scroll-hide"
            style={{
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflowY: full ? 'auto' : 'hidden',
              overscrollBehavior: 'contain',
              touchAction: full ? 'pan-y' : 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {children}
          </div>
        </SheetContext>
      </motion.section>
    </div>
  );
}

const SheetContext = React.createContext<{ startDrag: (event: React.PointerEvent) => void; detent: Detent; dismissible: boolean }>({
  startDrag: () => {},
  detent: 'peek',
  dismissible: false,
});

/** The current detent, for screens that lay out differently at peek. */
export function useSheetDetent(): Detent {
  return React.use(SheetContext).detent;
}

/** Soft scroll edge (Apple's): content dissolves into the sheet under pinned chrome. */
function scrollEdge(direction: 'down' | 'up'): React.CSSProperties {
  return {
    position: 'absolute',
    insetInline: 0,
    [direction === 'down' ? 'top' : 'bottom']: '100%',
    height: 'var(--sp-7)',
    background: `linear-gradient(to ${direction === 'down' ? 'bottom' : 'top'}, var(--surface-card), transparent)`,
    pointerEvents: 'none',
  };
}

/**
 * Pinned to the top of the sheet while its content scrolls, and the sheet's
 * drag handle. Put the screen's title and controls here. On a dismissible
 * sheet its right edge keeps clear of the close button — both edges with
 * `align="center"`, so centred content stays centred on the sheet.
 */
export function SheetHeader({
  children,
  align = 'start',
  style,
}: {
  children: React.ReactNode;
  align?: 'start' | 'center';
  style?: React.CSSProperties;
}) {
  const { startDrag, dismissible } = React.use(SheetContext);
  return (
    <div
      onPointerDown={(event) => {
        // A control in the header (a button, a field) keeps its own pointer.
        if ((event.target as HTMLElement).closest('button, a, input, textarea, [role="button"]')) return;
        startDrag(event);
      }}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        flex: '0 0 auto',
        paddingInlineStart: dismissible && align === 'center' ? CLOSE_CLEARANCE : 'var(--gutter)',
        paddingInlineEnd: dismissible ? CLOSE_CLEARANCE : 'var(--gutter)',
        background: 'var(--surface-card)',
        touchAction: 'none',
        ...style,
      }}
    >
      {children}
      <div aria-hidden="true" style={scrollEdge('down')} />
    </div>
  );
}

/** Pinned under the content, above the home indicator: the screen's one primary action. */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        marginTop: 'auto',
        paddingTop: 'var(--sp-6)',
        paddingInline: 'var(--gutter)',
        paddingBottom: 'max(env(safe-area-inset-bottom), var(--sp-7))',
        background: 'var(--surface-card)',
      }}
    >
      <div aria-hidden="true" style={scrollEdge('up')} />
      {children}
    </div>
  );
}
