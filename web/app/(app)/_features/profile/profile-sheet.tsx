"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth/session";
import { ActionPill } from "@/lib/discovery/components/ActionPill";
import { Avatar } from "@/lib/discovery/components/Avatar";
import { Button } from "@/lib/discovery/components/Button";
import { Dialog } from "@/lib/discovery/components/Dialog";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { Sticker } from "@/lib/discovery/components/Sticker";
import { Switch } from "@/lib/discovery/components/Switch";
import { readReduceTransparency, writeReduceTransparency } from "@/lib/discovery/liquid-glass/use-liquid-glass";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { useLocation } from "@/lib/platform/location";
import { formatCount } from "@/lib/stashh/format";
import { useLists, useMe, usePlaces } from "@/lib/stashh/queries";
import { countBy } from "@/lib/stashh/selectors";
import type { SavedPlace } from "@/lib/stashh/types";
import { createStoredFlag, useWatchClipboard } from "../recognize/stored-flag";
import { Section, SheetBody } from "../shell/sheet-parts";
import { profileCopy } from "./copy";

/** The ID card's slight tilt, as in the design. */
const CARD_TILT = "rotate(-1.2deg)";
/** The ID card's dashed edge. */
const CARD_DASH = 2;
/** The sticker's tilt in degrees. */
const STICKER_ANGLE = 4;
/** Saves in one neighbourhood before the profile calls you a regular there. */
const REGULAR_MIN = 3;
/** Above the sheet and the map chrome. */
const DIALOG_LAYER = 100;

/** Reduce Transparency, as a switch; the map's glass re-tiers as soon as it changes. */
const useReduceTransparency = createStoredFlag({ read: readReduceTransparency, write: writeReduceTransparency, fallback: false });

/** The reader's ID card, their device settings, and signing out. */
export function ProfileSheet() {
  const c = useCopy(profileCopy);
  const [confirming, setConfirming] = React.useState(false);

  return (
    <SheetBody>
      <IdCard />
      <Section label={c.settings}>
        <Settings />
        <Button variant="danger" size="lg" shape="pill" fullWidth onClick={() => setConfirming(true)} style={{ marginTop: "var(--sp-8)" }}>
          {c.signOut}
        </Button>
      </Section>
      {confirming ? <SignOutDialog onCancel={() => setConfirming(false)} /> : null}
    </SheetBody>
  );
}

/** Who you are on Stashh: name, handle, where and since when, what you have saved. */
function IdCard() {
  const c = useCopy(profileCopy);
  const t = useT();
  const locale = useIntlLocale();
  const me = useMe();
  const places = usePlaces();
  const lists = useLists();

  if (!me.data) return null;
  const { display_name, instagram_username, created_at, saved_count } = me.data;
  const handle = instagram_username ? `@${instagram_username}` : null;
  const name = display_name ?? handle;
  const { city, cities, district } = whereabouts(places.data ?? []);
  const joined = c.joined(new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(created_at)));

  const stats = [
    { label: c.stats.places, value: saved_count },
    { label: c.stats.lists, value: lists.data?.length ?? 0 },
    { label: c.stats.cities, value: cities },
  ];

  return (
    // Room above the card for its sticker, below the sheet's close button.
    <div style={{ paddingTop: "var(--sp-13)", display: "flex", justifyContent: "center" }}>
      <section
        aria-label={name ?? t.common.profile}
        style={{
          position: "relative",
          width: "calc(100% - var(--sp-5))",
          padding: "var(--sp-10) var(--sp-8) var(--sp-9)",
          borderRadius: "var(--r-card-lg)",
          background: "var(--bone-50)",
          border: `${CARD_DASH}px dashed var(--bone-400)`,
          transform: CARD_TILT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)" }}>
          <Avatar size="xl" name={display_name ?? instagram_username ?? ""} ring />
          <div style={{ minWidth: 0 }}>
            {name ? (
              <h2 className="ds-title-1" style={{ margin: 0, fontWeight: "var(--fw-black)", letterSpacing: "var(--tr-display)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </h2>
            ) : null}
            {display_name && handle ? (
              <p className="ds-caption" style={{ margin: 0, color: TEXT_SECONDARY_STRONG }}>
                {handle}
              </p>
            ) : null}
            <MicroLabel as="p" style={{ margin: name ? "var(--sp-1) 0 0" : 0, textWrap: "balance" }}>
              {[city, joined].filter(Boolean).join(" · ")}
            </MicroLabel>
          </div>
        </div>
        <dl style={{ display: "flex", gap: "var(--sp-5)", margin: "var(--sp-9) 0 0" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ flex: 1, padding: "var(--sp-7) var(--sp-6)", borderRadius: "var(--r-cta)", background: "var(--surface-card)", boxShadow: "var(--sh-card)", textAlign: "center", display: "flex", flexDirection: "column-reverse" }}>
              <dt className="ds-nano" style={{ marginTop: "var(--sp-2)", color: TEXT_SECONDARY_STRONG }}>
                {s.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontFamily: "var(--font-rounded)",
                  fontSize: "var(--fs-title-1)",
                  lineHeight: 1,
                  fontWeight: "var(--fw-black)",
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text-primary)",
                }}
              >
                {formatCount(s.value, locale)}
              </dd>
            </div>
          ))}
        </dl>
        {district ? (
          <Sticker tone="acid" angle={STICKER_ANGLE} style={{ position: "absolute", top: "calc(-1 * var(--sp-7))", right: "var(--sp-5)" }}>
            {c.regular(district)}
          </Sticker>
        ) : null}
      </section>
    </div>
  );
}

/** Home city (most saves), how many cities, and the neighbourhood you are a regular in, if any. */
function whereabouts(places: SavedPlace[]): { city: string | null; cities: number; district: string | null } {
  const byCity = countBy(places, (p) => p.city);
  const topDistrict = countBy(places, (p) => p.district)[0];
  return {
    city: byCity[0]?.key ?? null,
    cities: byCity.length,
    district: topDistrict && topDistrict.count >= REGULAR_MIN ? topDistrict.key : null,
  };
}

function Settings() {
  const c = useCopy(profileCopy);
  const [watchClipboard, setWatchClipboard] = useWatchClipboard();
  const [reduceTransparency, setReduceTransparency] = useReduceTransparency();
  const { state, locate } = useLocation();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)" }}>
      <SettingRow title={c.watchClipboard} hint={c.watchClipboardHint}>
        {(hintId) => <Switch checked={watchClipboard} onChange={setWatchClipboard} label={c.watchClipboard} aria-describedby={hintId} />}
      </SettingRow>
      <SettingRow title={c.reduceTransparency} hint={c.reduceTransparencyHint}>
        {(hintId) => <Switch checked={reduceTransparency} onChange={setReduceTransparency} label={c.reduceTransparency} aria-describedby={hintId} />}
      </SettingRow>
      <SettingRow title={c.location} hint={c.locationHint[state.status]}>
        {(hintId) =>
          state.status === "granted" ? null : (
            <ActionPill aria-describedby={hintId} disabled={state.status === "locating"} onClick={() => void locate()} style={{ flex: "0 0 auto" }}>
              {c.turnOn}
            </ActionPill>
          )
        }
      </SettingRow>
    </div>
  );
}

/** A setting: its name and a grey line saying what it does (or its state), and its control. */
function SettingRow({ title, hint, children }: { title: string; hint: string; children: (hintId: string) => React.ReactNode }) {
  const hintId = React.useId();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)", minHeight: "var(--hit-min)", padding: "var(--sp-7) var(--sp-8)", borderRadius: "var(--r-card-lg)", background: "var(--surface-sunken)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ds-headline" style={{ fontSize: "var(--fs-body-lg)" }}>
          {title}
        </div>
        <div id={hintId} aria-live="polite" className="ds-caption" style={{ color: TEXT_SECONDARY_STRONG }}>
          {hint}
        </div>
      </div>
      {children(hintId)}
    </div>
  );
}

/** "Sign out of Stashh?" over everything; cancel is focused, Escape and the scrim cancel. */
function SignOutDialog({ onCancel }: { onCancel: () => void }) {
  const c = useCopy(profileCopy);
  const t = useT();
  const client = useQueryClient();

  const confirm = async () => {
    await signOut();
    // The next reader on this device must not see this one's cache.
    client.clear();
  };

  return createPortal(
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      style={{ position: "fixed", inset: 0, zIndex: DIALOG_LAYER, display: "grid", placeItems: "center", padding: "var(--gutter)", background: "var(--scrim)" }}
    >
      <Dialog
        aria-modal="true"
        aria-label={c.signOutTitle}
        title={c.signOutTitle}
        body={c.signOutBody}
        confirmLabel={c.signOut}
        cancelLabel={t.common.cancel}
        destructive
        onConfirm={() => void confirm()}
        onCancel={onCancel}
        style={{ maxWidth: "100%" }}
      />
    </div>,
    document.body,
  );
}
