'use client';

import * as React from 'react';
import { motion, useDragControls, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { motionToken } from '../token-values';
import { Glyph } from './Glyph';
import { IconButton } from './IconButton';
import { ScreenScroll, scrollEdge, type NavTitle } from './Screen';

/** A sheet's top edge: under the safe area, leaving a strip of the screen it covers in view. */
const SHEET_TOP = 'calc(env(safe-area-inset-top) + var(--sp-7))';
/** How far a covered screen steps back — Apple's page-sheet recede. */
const RECEDE_SCALE = 0.92;
/** The page steps back to the safe area; a covered sheet also rises, so its top shows above the sheet over it. */
const RECEDE_PAGE = `translateY(env(safe-area-inset-top)) scale(${RECEDE_SCALE})`;
const RECEDE_SHEET = `translateY(calc(-1 * var(--sp-4))) scale(${RECEDE_SCALE})`;
const RECEDE_TRANSITION = 'transform var(--dur-sheet) var(--ease-out), border-radius var(--dur-sheet) var(--ease-out)';
/** A drag down the navigation bar dismisses the sheet past this distance (px) or flick speed (px/s). */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

/**
 * The screen sheets are presented over. While a sheet covers it, it steps back
 * — smaller, rounded — and takes no input. Its own stacking context keeps
 * anything floating inside it (a + button) under the sheets.
 */
export function PresentingLayer({ covered, children }: { covered: boolean; children: React.ReactNode }) {
  return (
    <div
      inert={covered}
      style={{
        position: 'absolute',
        inset: 0,
        isolation: 'isolate',
        overflow: 'hidden',
        transformOrigin: 'top center',
        transform: covered ? RECEDE_PAGE : 'none',
        borderRadius: covered ? 'var(--r-sheet)' : 0,
        transition: RECEDE_TRANSITION,
      }}
    >
      {children}
    </div>
  );
}

type PageSheetProps = {
  onClose: () => void;
  /** The close button's accessible name ("Close"). */
  closeLabel?: string;
  /** Another sheet is presented over this one: it steps back and takes no input. */
  covered?: boolean;
  /** The sheet's name when its screen has no title to show in the navigation bar. */
  'aria-label'?: string;
  /** The screen: `ScreenHeader` (with a `navTitle`), content, `ScreenFooter`. */
  children?: React.ReactNode;
};

/**
 * A screen presented over the current one, the way iOS presents a page sheet:
 * it slides up from the bottom, the screen under it steps back, and a
 * navigation bar on top carries the close button and — once the screen's own
 * title has scrolled away — that title. Dragging the bar down, the close
 * button, Escape and a tap on the strip above all dismiss it. Mount it inside
 * `AnimatePresence` so it slides away; sheets stack in mount order.
 */
export function PageSheet({ onClose, closeLabel = 'Close', covered = false, 'aria-label': ariaLabel, children }: PageSheetProps) {
  const reduceMotion = useReducedMotion();
  const drag = useDragControls();
  const titleId = React.useId();
  const sheetRef = React.useRef<HTMLElement>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const [navTitle, setNavTitle] = React.useState<NavTitle>(null);
  const { duration, ease } = motionToken('--dur-sheet', '--ease-out');
  const away = reduceMotion ? { opacity: 0 } : { y: '100%' };
  const here = reduceMotion ? { opacity: 1 } : { y: 0 };

  // Focus is a DOM fact: it moves into the sheet when it opens, back to what opened it when it closes.
  // The opener is kept only from outside the sheet, so a re-run of this effect cannot record the sheet itself.
  React.useEffect(() => {
    const sheet = sheetRef.current;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !sheet?.contains(active)) openerRef.current = active;
    sheet?.focus({ preventScroll: true });
    return () => {
      const opener = openerRef.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <motion.div
        aria-hidden="true"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration, ease }}
        style={{ position: 'absolute', inset: 0, background: 'var(--scrim)' }}
      />
      <motion.section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={navTitle ? titleId : undefined}
        aria-label={navTitle ? undefined : ariaLabel}
        tabIndex={-1}
        inert={covered}
        initial={away}
        animate={here}
        exit={away}
        transition={{ duration, ease }}
        drag={covered || reduceMotion ? false : 'y'}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        onDragEnd={(_event, info) => {
          if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          // A dialog open inside the sheet answers its own Escape.
          if (event.target instanceof Element && event.target.closest('dialog, [aria-modal="true"]') !== event.currentTarget) return;
          onClose();
        }}
        style={{ position: 'absolute', top: SHEET_TOP, insetInline: 0, bottom: 0, outline: 'none' }}
      >
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--surface-card)',
            borderTopLeftRadius: 'var(--r-sheet)',
            borderTopRightRadius: 'var(--r-sheet)',
            boxShadow: 'var(--sh-sheet)',
            transformOrigin: 'top center',
            transform: covered ? RECEDE_SHEET : 'none',
            transition: RECEDE_TRANSITION,
          }}
        >
          <NavBar title={navTitle} titleId={titleId} closeLabel={closeLabel} onClose={onClose} onDragStart={(event) => drag.start(event)} />
          <ScreenScroll mode="sheet" setNavTitle={setNavTitle}>
            {children}
          </ScreenScroll>
        </div>
      </motion.section>
    </div>
  );
}

/** The sheet's bar: the inline title (centred, shown once the large one is gone) and the close button. Dragging it moves the sheet. */
function NavBar({
  title,
  titleId,
  closeLabel,
  onClose,
  onDragStart,
}: {
  title: NavTitle;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  onDragStart: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onDragStart}
      style={{
        position: 'relative',
        zIndex: 2,
        flex: '0 0 auto',
        display: 'grid',
        gridTemplateColumns: 'var(--hit-min) minmax(0, 1fr) var(--hit-min)',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-5) var(--sp-7) var(--sp-4)',
        background: 'var(--surface-card)',
        touchAction: 'none',
      }}
    >
      <span aria-hidden="true" />
      {/* The screen's heading is read where it stands; this copy only names the dialog. */}
      <span
        id={titleId}
        aria-hidden="true"
        className="ds-headline"
        style={{
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: title?.shown ? 1 : 0,
          transition: 'opacity var(--dur-fast) var(--ease-out)',
        }}
      >
        {title?.title}
      </span>
      <IconButton
        variant="plain"
        label={closeLabel}
        onClick={onClose}
        style={{ background: 'var(--fill-secondary-on-white)', color: 'var(--grey-800)' }}
      >
        <Glyph icon={X} />
      </IconButton>
      <div aria-hidden="true" style={scrollEdge('down')} />
    </div>
  );
}
