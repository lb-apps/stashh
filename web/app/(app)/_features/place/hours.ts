import { MINUTES_PER_DAY, MINUTES_PER_WEEK, localWeekMinute, periodCovers, venueOffset, weekMinute } from "@/lib/stashh/selectors";
import type { OpeningPeriod } from "@/lib/stashh/types";

/**
 * A place's opening hours, from Google's periods (day 0 = Sunday, in the
 * venue's local time). Pure: times and weekday names are formatted with `Intl`
 * in the reader's locale; the venue-time maths is the selectors' (`isOpenNow`
 * uses the same), so the chip and the sheet always agree.
 */

type WeekPoint = OpeningPeriod["open"];

/** The week as the design lists it: Monday first. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
/** 7 January 2024 was a Sunday: `SUNDAY + day` lands on Google's day number. */
const SUNDAY = Date.UTC(2024, 0, 7);

/** Today's day (0 = Sunday) and the minute of the week, in the venue's local time. */
function venueNow(now: Date, utcOffsetMinutes: number | null): { day: number; minute: number } {
  const minute = localWeekMinute(now, venueOffset(utcOffsetMinutes, now));
  return { day: Math.floor(minute / MINUTES_PER_DAY), minute };
}

/** Google's "open 24/7" is a period with no close. */
function alwaysOpen(periods: OpeningPeriod[]): boolean {
  return periods.some((p) => !p.close);
}

/** The locale's own short time: "8:00 AM" in English, "08:00" in Turkish. */
export function formatClock(point: Pick<WeekPoint, "hour" | "minute">, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "UTC" }).format(
    new Date(SUNDAY + (point.hour * 60 + point.minute) * 60_000),
  );
}

/** "Tuesday" / "Salı" (or "Tue" / "Sal" with `short`). */
export function weekdayName(day: number, locale: string, width: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(new Date(SUNDAY + day * MINUTES_PER_DAY * 60_000));
}

export type DayHours = { kind: "closed" } | { kind: "allDay" } | { kind: "ranges"; ranges: string[] };

export interface WeekdayHours {
  /** 0 = Sunday. */
  day: number;
  name: string;
  hours: DayHours;
}

/** One row per weekday, Monday first: closed, open all day, or its opening ranges ("8:00 AM – 8:00 PM"). */
export function weeklyHours(periods: OpeningPeriod[], locale: string): WeekdayHours[] {
  const always = alwaysOpen(periods);
  return WEEK_ORDER.map((day) => {
    const name = weekdayName(day, locale);
    if (always) return { day, name, hours: { kind: "allDay" } };
    const opens = periods.filter((p) => p.open.day === day).sort((a, b) => weekMinute(a.open) - weekMinute(b.open));
    if (!opens.length) return { day, name, hours: { kind: "closed" } };
    const [first] = opens;
    // Midnight to midnight is a whole day.
    const span = first.close ? (weekMinute(first.close) - weekMinute(first.open) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK : 0;
    if (opens.length === 1 && first.open.hour === 0 && first.open.minute === 0 && span === MINUTES_PER_DAY) {
      return { day, name, hours: { kind: "allDay" } };
    }
    const ranges = opens.map((p) => `${formatClock(p.open, locale)} – ${p.close ? formatClock(p.close, locale) : ""}`);
    return { day, name, hours: { kind: "ranges", ranges } };
  });
}

/** Today's weekday (0 = Sunday) in the venue's local time. */
export function venueToday(utcOffsetMinutes: number | null, now = new Date()): number {
  return venueNow(now, utcOffsetMinutes).day;
}

/**
 * The next change of state: open until when (`until` null = never closes), or
 * closed until when (`sameDay` when that is later today). Null without hours.
 */
export type HoursChange = { open: true; until: WeekPoint | null } | { open: false; opens: WeekPoint; sameDay: boolean };

export function nextChange(periods: OpeningPeriod[] | null, utcOffsetMinutes: number | null, now = new Date()): HoursChange | null {
  if (!periods?.length) return null;
  if (alwaysOpen(periods)) return { open: true, until: null };
  const { day: today, minute: t } = venueNow(now, utcOffsetMinutes);

  const current = periods.find((p) => periodCovers(p, t));

  if (current) {
    // Back-to-back periods (closes at midnight, reopens at midnight) are one opening.
    let until = current.close!;
    for (let i = 0; i < periods.length; i++) {
      const next = periods.find((p) => weekMinute(p.open) === weekMinute(until) % MINUTES_PER_WEEK);
      if (!next?.close) break;
      if (next === current) return { open: true, until: null };
      until = next.close;
    }
    return { open: true, until };
  }

  const upcoming = periods
    .map((p) => ({ point: p.open, delta: (weekMinute(p.open) - t + MINUTES_PER_WEEK) % MINUTES_PER_WEEK }))
    .sort((a, b) => a.delta - b.delta)[0];
  return { open: false, opens: upcoming.point, sameDay: upcoming.point.day === today && upcoming.delta < MINUTES_PER_DAY };
}
