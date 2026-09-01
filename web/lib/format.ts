/** Compact, scannable duration. Keeps column widths stable while a run is live. */
export function formatDuration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)}s`;
  const minutes = Math.floor(ms / 60_000);
  return `${minutes}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Milliseconds between two ISO timestamps, or null when either is missing. */
export function elapsedBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!from || !to) return null;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return end - start;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleTimeString(undefined, {
    hour12: false,
    minute: "2-digit",
    hour: "2-digit",
    second: "2-digit",
  });
}

export function formatCoords(
  location: { latitude: number; longitude: number } | null,
): string | null {
  if (!location) return null;
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}
