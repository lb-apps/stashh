/** Number, duration and money formatting for the dashboard, in Turkish. */

const integer = new Intl.NumberFormat("tr-TR");
const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });
const dateTime = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const DASH = "—";

export function formatInt(value: number | null | undefined): string {
  return value == null ? DASH : integer.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  return value == null ? DASH : compact.format(value);
}

/** Share of `part` in `whole`; a dash when there is no whole to divide by. */
export function formatShare(part: number, whole: number): string {
  return whole > 0 ? percent.format(part / whole) : DASH;
}

export function formatUsd(value: number | null | undefined): string {
  return value == null ? DASH : usd.format(value);
}

/** 850 ms, 12,4 sn, 3 dk 05 sn, 2 sa 10 dk. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return DASH;
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk ${String(Math.floor(seconds % 60)).padStart(2, "0")} sn`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}

export function formatBucket(iso: string, bucket: "hour" | "day"): string {
  return (bucket === "hour" ? time : dayMonth).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : DASH;
}

/** A source URL short enough for a table cell: host + path, no scheme or query. */
export function formatSource(url: string | null): string {
  if (!url) return DASH;
  if (url.startsWith("instagram-media:")) return `Instagram gönderisi · ${url.slice("instagram-media:".length)}`;
  try {
    const parsed = new URL(url);
    return `${parsed.host.replace(/^www\./, "")}${parsed.pathname}`;
  } catch {
    return url;
  }
}

const relative = new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" });

/** "3 dakika önce", "dün" — relative to `now`. */
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}
