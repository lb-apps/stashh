'use client';

import * as React from 'react';

/** Room above a page's content: the safe area under a notch, never less than the token. */
const TOP = 'max(env(safe-area-inset-top), var(--sp-8))';

/** A screen's large title once it has scrolled out of view, for a page sheet's navigation bar to show instead. */
export type NavTitle = { title: string; shown: boolean } | null;

interface ScreenScope {
  /** `page`: the screen sheets are presented over. `sheet`: a `PageSheet`, under its navigation bar. */
  mode: 'page' | 'sheet';
  scrollToTop: () => void;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  setNavTitle: (title: NavTitle) => void;
}

const noop = () => {};
const ScreenContext = React.createContext<ScreenScope>({ mode: 'page', scrollToTop: noop, scrollRoot: { current: null }, setNavTitle: noop });

/** Scrolls the screen's content back to its top — for a screen that swaps what it shows in place. */
export function useScreenScroll(): () => void {
  return React.use(ScreenContext).scrollToTop;
}

/**
 * The scrolling content of a page or a page sheet, and what `ScreenHeader` and
 * `useScreenScroll` need to know about it. Used by `Screen` and `PageSheet`.
 */
export function ScreenScroll({
  mode,
  setNavTitle = noop,
  children,
}: {
  mode: ScreenScope['mode'];
  setNavTitle?: (title: NavTitle) => void;
  children?: React.ReactNode;
}) {
  const scrollRoot = React.useRef<HTMLDivElement>(null);
  const scrollToTop = React.useCallback(() => scrollRoot.current?.scrollTo({ top: 0 }), []);
  const scope = React.useMemo(() => ({ mode, scrollToTop, scrollRoot, setNavTitle }), [mode, scrollToTop, setNavTitle]);
  return (
    <ScreenContext value={scope}>
      <div
        ref={scrollRoot}
        className="ds-scroll-hide"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </ScreenContext>
  );
}

/**
 * The full-page screen everything else is presented over: a white surface over
 * the whole viewport whose content scrolls. It renders `ScreenHeader` (pinned),
 * its content, and optionally `ScreenFooter` (pinned primary action).
 */
export function Screen({ children, 'aria-label': ariaLabel }: { children?: React.ReactNode; 'aria-label'?: string }) {
  return (
    <section
      aria-label={ariaLabel}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-card)' }}
    >
      <div aria-hidden="true" style={{ flex: '0 0 auto', height: TOP }} />
      <ScreenScroll mode="page">{children}</ScreenScroll>
    </section>
  );
}

/** Soft scroll edge (Apple's): content dissolves into the screen under pinned chrome. */
export function scrollEdge(direction: 'down' | 'up'): React.CSSProperties {
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
 * The screen's title and controls. On a page it stays pinned while the content
 * scrolls. In a page sheet it scrolls away under the navigation bar, which then
 * shows `navTitle` instead — Apple's large title.
 */
export function ScreenHeader({ children, navTitle, style }: { children: React.ReactNode; navTitle?: string; style?: React.CSSProperties }) {
  const { mode, scrollRoot, setNavTitle } = React.use(ScreenContext);
  const ref = React.useRef<HTMLDivElement>(null);
  const inSheet = mode === 'sheet';

  // Whether the header is still in view is a fact of the scroll container, not state of ours.
  React.useEffect(() => {
    const header = ref.current;
    const root = scrollRoot.current;
    if (!inSheet || !navTitle || !header || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry) setNavTitle({ title: navTitle, shown: !entry.isIntersecting });
      },
      { root },
    );
    observer.observe(header);
    return () => {
      observer.disconnect();
      setNavTitle(null);
    };
  }, [inSheet, navTitle, scrollRoot, setNavTitle]);

  return (
    <div
      ref={ref}
      style={{
        position: inSheet ? 'relative' : 'sticky',
        top: 0,
        zIndex: 1,
        flex: '0 0 auto',
        paddingInline: 'var(--gutter)',
        background: 'var(--surface-card)',
        ...style,
      }}
    >
      {children}
      {inSheet ? null : <div aria-hidden="true" style={scrollEdge('down')} />}
    </div>
  );
}

/** Pinned under the content, above the home indicator: the screen's one primary action. */
export function ScreenFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        marginTop: 'auto',
        paddingTop: 'var(--sp-6)',
        paddingInline: 'var(--gutter)',
        paddingBottom: 'max(var(--safe-area-bottom, env(safe-area-inset-bottom)), var(--sp-7))',
        background: 'var(--surface-card)',
      }}
    >
      <div aria-hidden="true" style={scrollEdge('up')} />
      {children}
    </div>
  );
}
