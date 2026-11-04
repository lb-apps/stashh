"use client";

import * as React from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Button, ButtonLink } from "@/lib/discovery/components/Button";
import { Checkbox } from "@/lib/discovery/components/Checkbox";
import { SheetFooter } from "@/lib/discovery/components/DetentSheet";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MetaDot } from "@/lib/discovery/components/MetaDot";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { Rating } from "@/lib/discovery/components/Rating";
import { TEXT_SECONDARY_STRONG } from "@/lib/discovery/pending-tokens";
import { useCopy, useIntlLocale, useT } from "@/lib/i18n/provider";
import { usePosition } from "@/lib/platform/location";
import { formatDistance, formatRating } from "@/lib/stashh/format";
import { useRecentRecognitions, useRecognition } from "@/lib/stashh/queries";
import { distanceMeters } from "@/lib/stashh/selectors";
import { placeCopy } from "../places/copy";
import { SheetBody, SheetTitle } from "../shell/sheet-parts";
import { useSheetNav } from "../shell/sheet-state";
import { recognizeCopy } from "./copy";
import { saveablePlaces, type SaveablePlace } from "./recognition-view";
import { parseSourceLink } from "./source-link";

/** The first few places start ticked: most Reels are a short list worth keeping whole. */
const PRESELECTED = 5;
/** Place photo size, and its stand-in glyph. */
const PHOTO = 64;
const PHOTO_GLYPH = 24;
/** "Open the post" glyph. */
const LINK_GLYPH = 18;

const ellipsis: React.CSSProperties = { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/**
 * What the Reel named, to tick before saving. Only places that matched a
 * Google place are listed: the rest have no address to save.
 */
export function ResultsSheet({ recognitionId }: { recognitionId: string }) {
  const c = useCopy(recognizeCopy);
  const t = useT();
  const nav = useSheetNav();
  const { data } = useRecognition(recognitionId);
  const recents = useRecentRecognitions();
  // Ticks the reader changed; every other place keeps its default (the first few on).
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({});

  const places = saveablePlaces(data);
  const isChecked = (place: SaveablePlace, index: number) => ticks[place.google_place_id] ?? index < PRESELECTED;
  const chosen = places.filter(isChecked).map((p) => p.google_place_id);
  const link = data ? parseSourceLink(data.source_url) : null;
  const author = recents.data?.find((r) => r.recognition_id === recognitionId)?.author_username ?? null;
  const resultId = data?.result_id ?? null;

  const next = () => {
    if (!resultId || !chosen.length) return;
    nav.open({ name: "listpicker", target: { kind: "recognition", recognitionId, resultId, googlePlaceIds: chosen } });
  };

  return (
    <>
      <SheetTitle title={data ? c.results.title(places.length, link?.kind ?? "reel") : t.common.loading}>
        {data ? (
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-5)", marginTop: "var(--sp-5)" }}>
            {author ? (
              <span className="ds-body" style={{ color: TEXT_SECONDARY_STRONG }}>
                {c.results.from(author)}
              </span>
            ) : null}
            <ButtonLink
              href={data.source_url}
              variant="secondary"
              size="sm"
              shape="pill"
              leadingIcon={<Glyph icon={ExternalLink} size={LINK_GLYPH} />}
              style={{ height: "var(--hit-min)", background: "var(--cobalt-50)", color: "var(--cobalt-500)" }}
            >
              {c.results.openPost}
            </ButtonLink>
          </div>
        ) : null}
      </SheetTitle>
      <SheetBody>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--row-gap)" }}>
          {places.map((place, i) => (
            <PlaceCheckRow
              key={place.google_place_id}
              place={place}
              checked={isChecked(place, i)}
              onToggle={(on) => setTicks((prev) => ({ ...prev, [place.google_place_id]: on }))}
            />
          ))}
        </div>
      </SheetBody>
      <SheetFooter>
        <Button variant="primary" size="lg" shape="pill" fullWidth disabled={!resultId || !chosen.length} onClick={next}>
          {chosen.length ? c.results.add(chosen.length) : c.results.nothingSelected}
        </Button>
      </SheetFooter>
    </>
  );
}

/**
 * A recognised place with its tick. The whole card toggles it for the thumb;
 * the checkbox inside is the one control keyboards and screen readers use
 * (its own click bubbles here, so a tap on it toggles once).
 */
function PlaceCheckRow({ place, checked, onToggle }: { place: SaveablePlace; checked: boolean; onToggle: (on: boolean) => void }) {
  const p = useCopy(placeCopy);
  const locale = useIntlLocale();
  const origin = usePosition();
  const rating = place.rating != null ? formatRating(place.rating, locale) : null;
  const distance = origin && place.location ? formatDistance(distanceMeters(origin, place.location), locale) : null;

  return (
    <div
      onClick={() => onToggle(!checked)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--sp-7)",
        padding: "var(--sp-7)",
        borderRadius: "var(--r-card-lg)",
        background: checked ? "var(--cobalt-50)" : "var(--surface-sunken)",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
      }}
    >
      <PlacePhoto
        src={place.thumbnail_url}
        category="default"
        glyph={MapPin}
        glyphSize={PHOTO_GLYPH}
        width={PHOTO}
        height={PHOTO}
        radius="var(--r-icon-sq)"
        raised
      />
      <span style={{ display: "block", flex: 1, minWidth: 0 }}>
        <span className="ds-headline" style={ellipsis}>
          {place.name}
        </span>
        {place.address ? (
          <span className="ds-caption" style={{ ...ellipsis, marginTop: "var(--sp-1)", color: TEXT_SECONDARY_STRONG }}>
            {place.address}
          </span>
        ) : null}
        {rating || distance ? (
          <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", marginTop: "var(--sp-3)" }}>
            {rating ? <Rating value={rating} label={p.rated(rating)} /> : null}
            {rating && distance ? <MetaDot /> : null}
            {distance ? (
              <span className="ds-micro" style={{ color: TEXT_SECONDARY_STRONG }}>
                {distance}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <Checkbox checked={checked} label={place.name} />
    </div>
  );
}
