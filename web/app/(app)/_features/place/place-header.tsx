"use client";

import * as React from "react";
import { Bookmark, Navigation } from "lucide-react";
import { track } from "@/lib/analytics/analytics";
import { Badge } from "@/lib/discovery/components/Badge";
import { ButtonLink } from "@/lib/discovery/components/Button";
import { SheetHeader } from "@/lib/discovery/components/DetentSheet";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { IconButton } from "@/lib/discovery/components/IconButton";
import { MetaDot } from "@/lib/discovery/components/MetaDot";
import { OpenChip } from "@/lib/discovery/components/OpenChip";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { Rating } from "@/lib/discovery/components/Rating";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePlatform } from "@/lib/platform/provider";
import { formatCount, formatPriceLevel } from "@/lib/stashh/format";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { usePlaceMeta } from "../places/use-place-meta";
import { useSheetNav } from "../shell/sheet-state";
import { placeSheetCopy } from "./copy";
import { formatClock, nextChange, weekdayName } from "./hours";
import { directionsHref } from "./links";

/** The header photo, square, and its stand-in glyph. */
const THUMB = 84;
const THUMB_GLYPH = 30;

/**
 * The pinned top of the sheet and its drag handle: photo, category (and
 * "visited") and the name. The sheet draws the close button.
 */
export function PlaceHeader({ place, photo }: { place: SavedPlace; photo: string | null }) {
  const t = useT();
  const copy = useCopy(placeSheetCopy);

  return (
    <SheetHeader style={{ paddingBottom: "var(--sp-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-7)" }}>
        <PlacePhoto
          src={photo}
          category={place.category_group}
          glyph={CATEGORY_GLYPH[place.category_group]}
          glyphSize={THUMB_GLYPH}
          width={THUMB}
          height={THUMB}
          radius="var(--r-card)"
          raised
        />
        <div style={{ flex: 1, minWidth: 0, paddingTop: "var(--sp-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            <Badge tone="grey">{t.categories[place.category_group]}</Badge>
            {place.visited_at ? <Badge tone="cobaltSoft">{copy.visited}</Badge> : null}
          </div>
          <h2 className="ds-display-2" style={{ margin: "var(--sp-3) 0 0", textWrap: "balance", overflowWrap: "anywhere" }}>
            {place.name}
          </h2>
        </div>
      </div>
    </SheetHeader>
  );
}

/**
 * What the peek shows under the name, so the map stays in view: the address,
 * rating · reviews · price · distance, whether it is open, and the two
 * actions. Each line is drawn only when there is something to say.
 */
export function PlaceSummary({ place }: { place: SavedPlace }) {
  const address = place.short_formatted_address ?? place.district ?? place.city;
  return (
    <div>
      {address ? (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-text)",
            fontSize: "var(--fs-body-lg)",
            lineHeight: "var(--lh-body-lg)",
            color: TEXT_SECONDARY_STRONG,
          }}
        >
          {address}
        </p>
      ) : null}
      <PlaceFacts place={place} />
      <OpenState place={place} />
      <PrimaryActions place={place} />
    </div>
  );
}

const factStyle: React.CSSProperties = {
  fontFamily: "var(--font-rounded)",
  fontSize: "var(--fs-caption)",
  lineHeight: "var(--lh-caption)",
  fontWeight: "var(--fw-heavy)",
  fontVariantNumeric: "tabular-nums",
  color: TEXT_SECONDARY_STRONG,
  whiteSpace: "nowrap",
};

/** Rating (and review count) · price · distance. */
function PlaceFacts({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const locale = useIntlLocale();
  const meta = usePlaceMeta(place);
  const price = formatPriceLevel(place.price_level, copy.priceMark);

  const facts: Array<{ key: string; node: React.ReactNode }> = [];
  if (meta.rating) {
    const count = place.rating_count ? formatCount(place.rating_count, locale) : null;
    facts.push({
      key: "rating",
      node: (
        <span
          role="img"
          aria-label={count ? copy.ratedWithCount(meta.rating, count) : (meta.ratingLabel ?? undefined)}
          style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}
        >
          <Rating value={meta.rating} />
          {count ? <span style={factStyle}>({count})</span> : null}
        </span>
      ),
    });
  }
  if (price && place.price_level) {
    facts.push({
      key: "price",
      node: (
        <span role="img" aria-label={copy.priceLabel(place.price_level)} style={factStyle}>
          {price}
        </span>
      ),
    });
  }
  if (meta.distance) facts.push({ key: "distance", node: <span style={factStyle}>{meta.distance}</span> });

  if (!facts.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-5)", marginTop: "var(--sp-6)" }}>
      {facts.map(({ key, node }, i) => (
        <React.Fragment key={key}>
          {i > 0 ? <MetaDot /> : null}
          {node}
        </React.Fragment>
      ))}
    </div>
  );
}

/** The open sign at chip scale and when that changes: "Open · until 9:00 PM", "Closed · Opens Tue 8:00 AM". */
function OpenState({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const locale = useIntlLocale();
  const change = nextChange(place.opening_hours, place.utc_offset_minutes);
  if (!change) return null;

  const detail = change.open
    ? change.until
      ? copy.openUntil(formatClock(change.until, locale))
      : copy.openAllDay
    : change.sameDay
      ? copy.opensAt(formatClock(change.opens, locale))
      : copy.opensOn(weekdayName(change.opens.day, locale, "short"), formatClock(change.opens, locale));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)", marginTop: "var(--sp-6)" }}>
      <OpenChip open={change.open}>{change.open ? copy.open : copy.closed}</OpenChip>
      <span style={{ ...factStyle, fontFamily: "var(--font-display)", fontWeight: "var(--fw-semibold)" }}>{detail}</span>
    </div>
  );
}

/** Directions (same tab: popups break in in-app browsers) and save to a list. */
function PrimaryActions({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const { os } = usePlatform();
  const { open } = useSheetNav();

  return (
    <div style={{ display: "flex", gap: "var(--sp-5)", marginTop: "var(--sp-8)" }}>
      <ButtonLink
        href={directionsHref(place, os)}
        onClick={() => track("directions_opened", {}, { leavesPage: true })}
        variant="primary"
        size="lg"
        shape="pill"
        leadingIcon={<Glyph icon={Navigation} />}
        style={{ flex: 1 }}
      >
        {copy.directions}
      </ButtonLink>
      <IconButton
        variant="floating"
        size="xl"
        label={copy.saveToList}
        onClick={() => open({ name: "listpicker", target: { kind: "place", placeId: place.id } })}
      >
        <Glyph icon={Bookmark} />
      </IconButton>
    </div>
  );
}
