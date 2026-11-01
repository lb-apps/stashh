'use client';

import * as React from 'react';

/** Strips the browser's button look so a component can draw its own. */
export const BUTTON_RESET: React.CSSProperties = {
  appearance: 'none',
  border: 'none',
  margin: 0,
  padding: 0,
  background: 'none',
  font: 'inherit',
  color: 'inherit',
  textAlign: 'inherit',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

/** Keyboard focus ring width. An outline, not a box-shadow: fills carry their own shadow and would swallow it. */
const FOCUS_OUTLINE = 3;

/** Discovery's keyboard focus ring, drawn as an outline around the element's own radius. */
export function focusOutline(visible: boolean): React.CSSProperties {
  return {
    outline: visible ? `${FOCUS_OUTLINE}px solid var(--cobalt-300)` : 'none',
    outlineOffset: FOCUS_OUTLINE,
  };
}

type PressHandlers<E extends HTMLElement> = Pick<
  React.DOMAttributes<E>,
  'onPointerDown' | 'onPointerUp' | 'onPointerLeave' | 'onPointerCancel' | 'onFocus' | 'onBlur'
>;

/**
 * Press and keyboard-focus feedback for a tappable surface: it shrinks on press
 * with the Discovery spring and shows a cobalt outline on keyboard focus.
 * Pass the caller's own handlers in; they still run.
 */
export function usePressable<E extends HTMLElement>(
  own: PressHandlers<E> = {},
  scale = 'var(--press-scale)',
): { handlers: Required<PressHandlers<E>>; style: React.CSSProperties } {
  const [pressed, setPressed] = React.useState(false);
  const [focusRing, setFocusRing] = React.useState(false);

  const handlers: Required<PressHandlers<E>> = {
    onPointerDown: (e) => {
      setPressed(true);
      own.onPointerDown?.(e);
    },
    onPointerUp: (e) => {
      setPressed(false);
      own.onPointerUp?.(e);
    },
    onPointerLeave: (e) => {
      setPressed(false);
      own.onPointerLeave?.(e);
    },
    onPointerCancel: (e) => {
      setPressed(false);
      own.onPointerCancel?.(e);
    },
    onFocus: (e) => {
      setFocusRing(e.currentTarget.matches(':focus-visible'));
      own.onFocus?.(e);
    },
    onBlur: (e) => {
      setFocusRing(false);
      own.onBlur?.(e);
    },
  };

  return {
    handlers,
    style: {
      transform: pressed ? `scale(${scale})` : 'scale(1)',
      transition: 'transform var(--dur-fast) var(--ease-spring)',
      ...focusOutline(focusRing),
    },
  };
}
