"use client";

import * as React from "react";
import { ExternalLink, Film, Image as ImageIcon } from "lucide-react";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MicroLabel } from "@/lib/discovery/components/MicroLabel";
import { PlacePhoto } from "@/lib/discovery/components/PlacePhoto";
import { usePressable } from "@/lib/discovery/use-pressable";
import { useCopy } from "@/lib/i18n/provider";
import type { SavedPlace } from "@/lib/stashh/types";
import { placeSheetCopy } from "./copy";
import { SECTION_GAP, SunkenCard } from "./parts";

/** The post's cover thumbnail and its stand-in glyph. */
const COVER = 52;
const COVER_GLYPH = 22;

/**
 * Where the place came from: the post's cover, "@author · Reel", and a link
 * back to the post. A post shared inside a DM has no URL, so no link.
 */
export function SourceBlock({ place }: { place: SavedPlace }) {
  const copy = useCopy(placeSheetCopy);
  const source = place.source;
  if (!source) return null;

  const line = [source.author_username ? `@${source.author_username}` : null, source.type ? copy.sourceType[source.type] : null]
    .filter(Boolean)
    .join(" · ");
  if (!line && !source.url) return null;
  const video = source.type === "reel" || source.type === "tiktok";

  return (
    <SunkenCard style={{ display: "flex", alignItems: "center", gap: "var(--sp-7)", marginTop: SECTION_GAP, padding: "var(--sp-7)" }}>
      <PlacePhoto
        src={source.thumbnail_url}
        category={place.category_group}
        glyph={video ? Film : ImageIcon}
        glyphSize={COVER_GLYPH}
        width={COVER}
        height={COVER}
        radius="var(--r-field)"
        raised
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MicroLabel>{copy.savedFrom}</MicroLabel>
        {line ? (
          <div
            style={{
              marginTop: "var(--sp-1)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-body)",
              lineHeight: "var(--lh-body)",
              fontWeight: "var(--fw-bold)",
              letterSpacing: "var(--tr-tight)",
              color: "var(--text-primary)",
            }}
          >
            {line}
          </div>
        ) : null}
      </div>
      {source.url ? <OpenPostLink href={source.url} label={copy.openPost} /> : null}
    </SunkenCard>
  );
}

/** A round floating link, same tab: popups break in in-app browsers. */
function OpenPostLink({ href, label }: { href: string; label: string }) {
  const press = usePressable<HTMLAnchorElement>({}, "var(--press-scale-tight)");
  return (
    <a
      href={href}
      aria-label={label}
      {...press.handlers}
      style={{
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        width: "var(--hit-min)",
        height: "var(--hit-min)",
        borderRadius: "var(--r-circle)",
        background: "var(--white)",
        color: "var(--cobalt-500)",
        boxShadow: "var(--sh-float)",
        WebkitTapHighlightColor: "transparent",
        ...press.style,
      }}
    >
      <Glyph icon={ExternalLink} />
    </a>
  );
}
