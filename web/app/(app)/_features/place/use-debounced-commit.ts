"use client";

import * as React from "react";

/**
 * Commits a value once it has been still for `delayMs`, or straight away on
 * `flush()` (e.g. on blur). A pending value is committed on unmount too, so
 * closing the sheet mid-sentence still saves.
 */
export function useDebouncedCommit<T>(commit: (value: T) => void, delayMs: number) {
  const commitRef = React.useRef(commit);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = React.useRef<{ value: T } | null>(null);

  React.useLayoutEffect(() => {
    commitRef.current = commit;
  });

  const flush = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (next) commitRef.current(next.value);
  }, []);

  const schedule = React.useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  React.useEffect(() => flush, [flush]);

  return { schedule, flush };
}
