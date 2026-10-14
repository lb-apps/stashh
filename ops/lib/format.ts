/** Number, duration, money and time formatting for the dashboard (US English). */

const LOCALE = "en-US";

const integer = new Intl.NumberFormat(LOCALE);
const decimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 });
const signedPercent = new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const usd = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const rating = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const time = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric" });
const dateTime = new Intl.DateTimeFormat(LOCALE, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

export const DASH = "—";

export function formatInt(value: number | null | undefined): string {
  return value == null ? DASH : integer.format(value);
}

export function formatDecimal(value: number | null | undefined): string {
  return value == null ? DASH : decimal.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  return value == null ? DASH : compact.format(value);
}

/** Share of `part` in `whole`; a dash when there is no whole to divide by. */
export function formatShare(part: number, whole: number): string {
  return whole > 0 ? percent.format(part / whole) : DASH;
}

export function formatPercent(ratio: number): string {
  return percent.format(ratio);
}

export function formatSignedPercent(ratio: number): string {
  return signedPercent.format(ratio);
}

export function formatUsd(value: number | null | undefined): string {
  return value == null ? DASH : usd.format(value);
}

export function formatRating(value: number | null | undefined): string {
  return value == null ? DASH : rating.format(value);
}

/** 850 ms, 12.4 s, 3 min 05 s, 2 h 10 min. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return DASH;
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${decimal.format(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(Math.floor(seconds % 60)).padStart(2, "0")} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatBucket(iso: string, bucket: "hour" | "day"): string {
  return (bucket === "hour" ? time : dayMonth).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : DASH;
}

/** "3 minutes ago", "yesterday" — relative to `now`. */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return DASH;
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, "second");
  if (abs < 3_600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3_600), "hour");
  return relative.format(Math.round(seconds / 86_400), "day");
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return DASH;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${integer.format(Math.round(bytes / 1024))} KB`;
  return `${decimal.format(bytes / 1024 / 1024)} MB`;
}

/** A source short enough for a table cell: host + path, no scheme or query. */
export function formatSource(url: string | null): string {
  if (!url) return DASH;
  if (url.startsWith("instagram-media:")) return `Instagram post · ${url.slice("instagram-media:".length)}`;
  try {
    const parsed = new URL(url);
    return `${parsed.host.replace(/^www\./, "")}${parsed.pathname}`;
  } catch {
    return url;
  }
}
