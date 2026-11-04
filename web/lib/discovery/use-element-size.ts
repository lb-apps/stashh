'use client';

import * as React from 'react';

/** Live size of an element (ResizeObserver). `null` until first measured. */
export function useElementSize<T extends HTMLElement>(): [React.RefCallback<T>, { width: number; height: number } | null] {
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null);
  const observer = React.useRef<ResizeObserver | null>(null);

  const ref = React.useCallback((node: T | null) => {
    observer.current?.disconnect();
    if (!node) return;
    // Measure now: ResizeObserver only reports after the next rendered frame,
    // which a background tab (or a hidden webview) may not produce for a while.
    const { width, height } = node.getBoundingClientRect();
    setSize({ width, height });
    observer.current = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.current.observe(node);
  }, []);

  return [ref, size];
}
