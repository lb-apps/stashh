"use client";

import * as React from "react";
import { ActionPill } from "@/lib/discovery/components/ActionPill";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale } from "@/lib/i18n/provider";
import type { SavedPlace } from "@/lib/stashh/types";
import { placeSheetCopy } from "./copy";
import { venueToday, weeklyHours, type DayHours } from "./hours";
import { SECTION_GAP, SunkenCard } from "./parts";

/**
 * Today's hours, and the whole week on demand with today picked out. The
 * header already says whether it is open, so this block doesn't repeat it.
 */
export function HoursBlock({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const locale = useIntlLocale();
  const [expanded, setExpanded] = React.useState(false);
  const weekId = React.useId();

  const periods = place.opening_hours;
  if (!periods?.length) return null;
  const week = weeklyHours(periods, locale);
  const today = venueToday(place.utc_offset_minutes);
  const todayHours = week.find((d) => d.day === today)?.hours;
  const describe = (hours: DayHours) =>
    hours.kind === "closed" ? copy.closedAllDay : hours.kind === "allDay" ? copy.openAllDayLong : hours.ranges.join(", ");

  return (
    <SunkenCard style={{ marginTop: SECTION_GAP }} role="region" aria-label={copy.hours}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-6)" }}>
        <div style={{ minWidth: 0 }}>
          <MicroLabel>{copy.today}</MicroLabel>
          <div
            style={{
              marginTop: "var(--sp-2)",
              fontFamily: "var(--font-text)",
              fontSize: "var(--fs-body-lg)",
              lineHeight: "var(--lh-body-lg)",
              color: "var(--text-primary)",
            }}
          >
            {todayHours ? describe(todayHours) : null}
          </div>
        </div>
        <ActionPill
          aria-expanded={expanded}
          aria-controls={weekId}
          onClick={() => setExpanded((v) => !v)}
          style={{ flex: "0 0 auto", height: "var(--hit-min)", padding: "0 var(--sp-7)", fontSize: "var(--fs-caption)" }}
        >
          {expanded ? copy.hideWeek : copy.showWeek}
        </ActionPill>
      </div>
      {expanded ? (
        <dl id={weekId} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", margin: "var(--sp-7) 0 0" }}>
          {week.map(({ day, name, hours }) => (
            <WeekRow key={day} name={name} hours={describe(hours)} today={day === today} />
          ))}
        </dl>
      ) : null}
    </SunkenCard>
  );
}

function WeekRow({ name, hours, today }: { name: string; hours: string; today: boolean }) {
  return (
    <div
      aria-current={today ? "date" : undefined}
      style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-7)", fontSize: "var(--fs-body)", lineHeight: "var(--lh-body)" }}
    >
      <dt style={{ fontFamily: "var(--font-display)", fontWeight: today ? "var(--fw-bold)" : "var(--fw-medium)", color: "var(--text-primary)" }}>
        {name}
      </dt>
      <dd
        style={{
          margin: 0,
          textAlign: "end",
          fontFamily: "var(--font-rounded)",
          fontWeight: today ? "var(--fw-heavy)" : "var(--fw-semibold)",
          fontVariantNumeric: "tabular-nums",
          color: today ? "var(--text-primary)" : TEXT_SECONDARY_STRONG,
        }}
      >
        {hours}
      </dd>
    </div>
  );
}
