"use client";

import * as React from "react";
import { Globe, ListPlus, type LucideIcon } from "lucide-react";
import { ActionPill } from "@/lib/discovery/components/ActionPill";
import { Badge } from "@/lib/discovery/components/Badge";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { BUTTON_RESET, usePressable } from "@/lib/discovery/use-pressable";
import { useCopy, useIntlLocale } from "@/lib/i18n/provider";
import { formatCount, formatDay, formatUntil } from "@/lib/stashh/format";
import { useBilling } from "@/lib/stashh/queries";
import type { BillingStatus, BillingTask } from "@/lib/stashh/types";
import { Section } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { profileCopy } from "./copy";
import { StatTile } from "./stat-tile";

/** Each task's glyph. */
const TASK_GLYPH: Record<BillingTask, LucideIcon> = { first_list: ListPlus, first_web_visit: Globe };

/**
 * The plan, today's allowance, credits, and the tasks still open to earn credits. Nothing until the
 * plan has loaded. An earned task leaves the list: the toast announced it, and a done row offers nothing.
 */
export function PlanSection() {
  const c = useCopy(profileCopy);
  const billing = useBilling().data;
  if (!billing) return null;
  const open = billing.tasks.filter((task) => !task.done);
  return (
    <>
      <Section label={c.plan}>
        <PlanCard billing={billing} />
      </Section>
      {open.length ? (
        <Section label={c.earn}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)" }}>
            {open.map((task) => (
              <TaskRow key={task.task} task={task.task} credits={task.credits} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  );
}

/**
 * The plan's name (and, on Premium, until when), what is left of today's
 * allowance and the credits, and — on free — the way to Premium. Once the
 * allowance is used up, when the next analysis comes back.
 */
function PlanCard({ billing }: { billing: BillingStatus }) {
  const c = useCopy(profileCopy);
  const locale = useIntlLocale();
  const { open } = useSheetNav();
  const n = (count: number) => formatCount(count, locale);
  const left = Math.max(0, billing.daily_limit - billing.used_today);
  const premium = billing.plan === "premium";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)", padding: "var(--sp-8)", borderRadius: "var(--r-card-lg)", background: "var(--surface-sunken)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)", minHeight: "var(--hit-min)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-headline" style={{ fontSize: "var(--fs-body-lg)" }}>
            {c.planName[billing.plan]}
          </div>
          {premium && billing.plan_expires_at ? (
            <div className="ds-caption" style={{ color: TEXT_SECONDARY_STRONG }}>
              {c.until(formatDay(billing.plan_expires_at, locale))}
            </div>
          ) : null}
        </div>
        {premium ? null : (
          <ActionPill tone="cobalt" onClick={() => open({ name: "premium", source: "profile" })} style={{ flex: "0 0 auto" }}>
            {c.seePremium}
          </ActionPill>
        )}
      </div>
      <dl style={{ display: "flex", gap: "var(--sp-5)", margin: 0 }}>
        <StatTile label={c.leftToday}>
          {n(left)}
          <span style={{ fontSize: "var(--fs-headline)", color: TEXT_SECONDARY_STRONG }}>/{n(billing.daily_limit)}</span>
        </StatTile>
        <StatTile label={c.credits}>{n(billing.credits)}</StatTile>
      </dl>
      {left === 0 && billing.next_free_at ? (
        <p className="ds-caption" style={{ margin: 0, color: TEXT_SECONDARY_STRONG }}>
          {c.nextFree(formatUntil(billing.next_free_at, locale))}
        </p>
      ) : null}
    </div>
  );
}

/** An open task and the credits it earns once. The first-list task takes you to making one. */
function TaskRow({ task, credits }: { task: BillingTask; credits: number }) {
  const c = useCopy(profileCopy);
  const { open } = useSheetNav();
  const press = usePressable<HTMLButtonElement>();

  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--sp-6)",
    width: "100%",
    minHeight: "var(--hit-min)",
    padding: "var(--sp-7) var(--sp-8)",
    borderRadius: "var(--r-card-lg)",
    background: "var(--surface-sunken)",
    textAlign: "left",
  };
  const content = (
    <>
      <span style={{ flex: "0 0 auto", color: "var(--grey-800)" }}>
        <Glyph icon={TASK_GLYPH[task]} />
      </span>
      <span className="ds-headline" style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-body-lg)" }}>
        {c.tasks[task]}
      </span>
      <Badge tone="cobaltSoft">{c.taskCredits(credits)}</Badge>
    </>
  );

  if (task !== "first_list") return <div style={row}>{content}</div>;
  return (
    <button type="button" onClick={() => open({ name: "newlist", target: { kind: "empty" } })} {...press.handlers} style={{ ...BUTTON_RESET, ...row, ...press.style }}>
      {content}
    </button>
  );
}
