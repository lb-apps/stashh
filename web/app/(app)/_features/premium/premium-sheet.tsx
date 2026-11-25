"use client";

import * as React from "react";
import { Clock, Coins, SearchCheck, type LucideIcon } from "lucide-react";
import { track } from "@/lib/analytics/analytics";
import type { PaywallSource } from "@/lib/analytics/events";
import { useSignedInUserId } from "@/lib/auth/session";
import { Button, ButtonLink } from "@/lib/discovery/components/Button";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { ScreenFooter } from "@/lib/discovery/components/Screen";
import { SegmentedControl } from "@/lib/discovery/components/SegmentedControl";
import { TEXT_DANGER_STRONG, TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { publicEnv } from "@/lib/env";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { StashhApiError } from "@/lib/stashh/api";
import { formatCount, formatDay, formatMoney } from "@/lib/stashh/format";
import { useMockPurchase, usePremiumPurchase } from "@/lib/stashh/mutations";
import { useBilling, usePremiumOffers, useSubscriptionManagementUrl } from "@/lib/stashh/queries";
import type { BillingStatus, Plan, PremiumPeriod } from "@/lib/stashh/types";
import { QuietNote, SheetBody, SheetTitle } from "../shell/sheet-parts";
import { premiumCopy } from "./copy";

const PERIODS: PremiumPeriod[] = ["monthly", "yearly"];
/** The large button's height (Discovery `Button` size `lg`), so "soon" takes its place without a jump. */
const CTA_H = 58;

/** The plan tiles' numerals: the display size, in the rounded scoreboard face. */
const NUMERAL: React.CSSProperties = {
  margin: "var(--sp-2) 0 0",
  fontFamily: "var(--font-rounded)",
  fontSize: "var(--fs-display-1)",
  lineHeight: "var(--lh-display-1)",
  fontWeight: "var(--fw-black)",
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-primary)",
};

/**
 * Premium: what each plan allows a day, the two rules that make the allowance
 * and credits fair, and the way in. Where purchases are on, the way in is a
 * price and Paddle's checkout; elsewhere (production, until Paddle is live) it
 * is the owner's mock purchase or a fake door that says "soon". Someone
 * already on Premium sees their plan instead.
 */
export function PremiumSheet({ source }: { source: PaywallSource }) {
  const c = useCopy(premiumCopy);
  const t = useT();
  const billing = useBilling();
  const seen = React.useRef(false);

  // Reported once the sheet is on screen, once per presentation (Strict Mode re-runs effects in development).
  React.useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    track("paywall_viewed", { source });
  }, [source]);

  return (
    <>
      <SheetTitle title={c.title} sub={c.headline} />
      {billing.data ? (
        <Premium status={billing.data} />
      ) : billing.isError ? (
        <SheetBody>
          <QuietNote>{t.errors.generic}</QuietNote>
        </SheetBody>
      ) : null}
    </>
  );
}

function Premium({ status }: { status: BillingStatus }) {
  const c = useCopy(premiumCopy);
  return (
    <>
      <SheetBody gap="var(--sp-9)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-5)" }}>
          <PlanTile plan="free" limit={status.plan_limits.free} />
          <PlanTile plan="premium" limit={status.plan_limits.premium} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
          <Rule icon={SearchCheck}>{c.allowance}</Rule>
          <Rule icon={Coins}>{c.credits}</Rule>
        </div>
      </SheetBody>
      <ScreenFooter>
        {status.plan === "premium" ? <OnPremium status={status} /> : publicEnv.revenueCatApiKey ? <PaidOffer /> : <Offer status={status} />}
      </ScreenFooter>
    </>
  );
}

/** One plan and its daily allowance. Premium stands up off the sheet; free sits in it. */
function PlanTile({ plan, limit }: { plan: Plan; limit: number }) {
  const c = useCopy(premiumCopy);
  const locale = useIntlLocale();
  const raised = plan === "premium";
  return (
    <div
      style={{
        padding: "var(--sp-8)",
        borderRadius: "var(--r-card-lg)",
        background: raised ? "var(--surface-card)" : "var(--surface-sunken)",
        boxShadow: raised ? "var(--sh-card-lg)" : "none",
      }}
    >
      <MicroLabel as="h3" tone={raised ? "primary" : "secondary"} style={{ margin: 0 }}>
        {c.plans[plan]}
      </MicroLabel>
      <p style={NUMERAL}>{formatCount(limit, locale)}</p>
      <p className="ds-caption" style={{ margin: 0, color: TEXT_SECONDARY_STRONG }}>
        {c.perDay}
      </p>
    </div>
  );
}

/** A rule of the allowance, beside its glyph. */
function Rule({ icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <p className="ds-body" style={{ display: "flex", gap: "var(--sp-6)", margin: 0 }}>
      <span style={{ flex: "0 0 auto", paddingTop: "var(--sp-1)", color: "var(--grey-800)" }}>
        <Glyph icon={icon} />
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Monthly or yearly. */
function PeriodPicker({ value, onChange }: { value: PremiumPeriod; onChange: (period: PremiumPeriod) => void }) {
  const c = useCopy(premiumCopy);
  return (
    <SegmentedControl
      aria-label={c.period}
      onWhite
      options={PERIODS.map((period) => ({ value: period, label: c.periods[period] }))}
      value={value}
      onChange={(next) => onChange(PERIODS.find((p) => p === next) ?? value)}
    />
  );
}

/**
 * The real way in: the period, its price from RevenueCat, the button that opens
 * Paddle's checkout, and how the subscription renews. The price keeps its line
 * while it loads, so nothing jumps; the button waits for it. Closing the
 * checkout is not an error. After a purchase the plan updates and the sheet
 * shows Premium in place of this.
 */
function PaidOffer() {
  const c = useCopy(premiumCopy);
  const t = useT();
  const locale = useIntlLocale();
  const userId = useSignedInUserId();
  const [period, setPeriod] = React.useState<PremiumPeriod>("monthly");
  const offers = usePremiumOffers();
  const purchase = usePremiumPurchase();
  const offer = offers.data?.[period];
  const failed = offers.isError || (offers.isSuccess && !offers.data) || purchase.isError;

  const buy = () => {
    if (!offer || !userId) return;
    track("premium_plan_selected", { period, available: true });
    purchase.mutate({ userId, offer, language: locale.split("-")[0] ?? locale });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <PeriodPicker value={period} onChange={setPeriod} />
      <p className="ds-headline" style={{ margin: 0, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {offer ? c.price[period](formatMoney(offer.amountMicros, offer.currency, locale)) : "\u00a0"}
      </p>
      {failed ? (
        <p role="alert" className="ds-caption" style={{ margin: 0, textAlign: "center", color: TEXT_DANGER_STRONG }}>
          {t.errors.generic}
        </p>
      ) : null}
      <Button variant="primary" size="lg" shape="pill" fullWidth disabled={!offer || purchase.isPending} onClick={buy}>
        {c.cta}
      </Button>
      <p className="ds-caption" style={{ margin: 0, textAlign: "center", color: TEXT_SECONDARY_STRONG }}>
        {c.renews[period]}
      </p>
    </div>
  );
}

/**
 * Where Premium cannot be bought: the period and the button. The button grants
 * Premium while mock purchases are on; otherwise — or when they were switched
 * off meanwhile — it turns into a calm "soon" in place, and the tap is the
 * interest we measure.
 */
function Offer({ status }: { status: BillingStatus }) {
  const c = useCopy(premiumCopy);
  const t = useT();
  const [period, setPeriod] = React.useState<PremiumPeriod>("monthly");
  const [interested, setInterested] = React.useState(false);
  const purchase = useMockPurchase();
  const unavailable = purchase.error instanceof StashhApiError && purchase.error.code === "PURCHASES_UNAVAILABLE";
  const soon = interested || unavailable;

  const choose = () => {
    track("premium_plan_selected", { period, available: status.mock_purchases });
    if (status.mock_purchases) purchase.mutate(period);
    else setInterested(true);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <PeriodPicker value={period} onChange={setPeriod} />
      {purchase.isError && !unavailable ? (
        <p role="alert" className="ds-caption" style={{ margin: 0, textAlign: "center", color: TEXT_DANGER_STRONG }}>
          {t.errors.generic}
        </p>
      ) : null}
      <div role="status">
        {soon ? (
          <p
            ref={takeFocus}
            tabIndex={-1}
            className="ds-label"
            style={{
              outline: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--sp-4)",
              height: CTA_H,
              margin: 0,
              borderRadius: "var(--r-pill)",
              background: "var(--surface-sunken)",
              color: "var(--text-primary)",
            }}
          >
            <Glyph icon={Clock} />
            {c.soon}
          </p>
        ) : (
          <Button variant="primary" size="lg" shape="pill" fullWidth disabled={purchase.isPending} onClick={choose}>
            {c.cta}
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Soon" replaces the button that had focus; focus moves onto it rather than falling to the page — a DOM sync, not state. */
function takeFocus(node: HTMLParagraphElement | null) {
  node?.focus({ preventScroll: true });
}

/**
 * In place of the button for someone already on Premium: the plan, until when,
 * and — when they bought it — where to change or cancel it.
 */
function OnPremium({ status }: { status: BillingStatus }) {
  const c = useCopy(premiumCopy);
  const locale = useIntlLocale();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-6)" }}>
      <div role="status" style={{ textAlign: "center" }}>
        <p className="ds-headline" style={{ margin: 0 }}>
          {c.onPremium}
        </p>
        {status.plan_expires_at ? (
          <p className="ds-caption" style={{ margin: 0, color: TEXT_SECONDARY_STRONG }}>
            {c.until(formatDay(status.plan_expires_at, locale))}
          </p>
        ) : null}
      </div>
      {status.plan_source === "revenuecat" ? <ManageSubscription /> : null}
    </div>
  );
}

/** Paddle's portal, through RevenueCat; shown once the link is known. */
function ManageSubscription() {
  const c = useCopy(premiumCopy);
  const url = useSubscriptionManagementUrl(true).data;
  return url ? (
    <ButtonLink href={url} target="_blank" rel="noopener noreferrer" variant="ghost" size="md" shape="pill">
      {c.manage}
    </ButtonLink>
  ) : null;
}
