"use client";

import { LocateFixed, LocateOff, Plus, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { GlassButton, GlassSurface } from "@/lib/discovery/components/Glass";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { IconButton } from "@/lib/discovery/components/IconButton";
import { useCopy } from "@/lib/i18n/provider";
import { countBy } from "@/lib/stashh/selectors";
import type { SavedPlace } from "@/lib/stashh/types";
import { shellCopy } from "./copy";

/**
 * The glass floating over the map: where you are and how much is saved there,
 * search and profile on the right, an offline note when there's no connection.
 */
export function MapHeader({
  places,
  online,
  filtered,
  onSearch,
  onFilter,
  onProfile,
}: {
  places: SavedPlace[];
  online: boolean;
  /** A filter narrows the map — the filter button carries a dot. */
  filtered: boolean;
  onSearch: () => void;
  onFilter: () => void;
  onProfile: () => void;
}) {
  const c = useCopy(shellCopy);
  const area = countBy(places, (p) => p.district)[0]?.key ?? null;
  const city = countBy(places, (p) => p.city)[0]?.key ?? null;

  return (
    <header
      className="app-inset-top"
      style={{
        position: "absolute",
        insetInline: 0,
        top: 0,
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-6)",
        paddingInline: "var(--sp-7)",
        pointerEvents: "none",
      }}
    >
      {online ? null : (
        <GlassSurface shape="capsule" role="status" className="ds-micro" style={{ alignSelf: "flex-start", padding: "var(--sp-4) var(--sp-7)", color: "var(--text-primary)" }}>
          {c.offline}
        </GlassSurface>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-6)" }}>
        <GlassSurface style={{ padding: "var(--sp-5) var(--sp-8) var(--sp-6)", pointerEvents: "auto", minWidth: 0 }}>
          <h1 className="ds-display-2" style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {area ?? city ?? "Stashh"}
          </h1>
          <div className="ds-micro" style={{ color: "var(--grey-800)" }}>
            {places.length ? c.savedHere(places.length, area ? city : null) : c.nothingSaved}
          </div>
        </GlassSurface>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", pointerEvents: "auto" }}>
          <GlassButton shape="circle" label={c.search} onClick={onSearch}>
            <Glyph icon={Search} />
          </GlassButton>
          <GlassButton shape="circle" label={filtered ? c.filterActive : c.filter} onClick={onFilter} style={{ position: "relative" }}>
            <Glyph icon={SlidersHorizontal} />
            {filtered ? <ActiveDot /> : null}
          </GlassButton>
          <GlassButton shape="circle" label={c.profile} onClick={onProfile}>
            <Glyph icon={UserRound} />
          </GlassButton>
        </div>
      </div>
    </header>
  );
}

function ActiveDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "var(--sp-3)",
        right: "var(--sp-3)",
        width: "var(--sp-4)",
        height: "var(--sp-4)",
        borderRadius: "var(--r-circle)",
        background: "var(--cobalt-500)",
        boxShadow: "0 0 0 var(--sp-1) var(--white)",
      }}
    />
  );
}

/** Recenter (and "Location off" when denied), riding just above the sheet. */
export function MapControls({ denied, onRecenter }: { denied: boolean; onRecenter: () => void }) {
  const c = useCopy(shellCopy);
  return (
    <div
      style={{
        position: "absolute",
        right: "var(--sp-7)",
        bottom: "calc(var(--sheet-cover, 0px) + var(--sp-6))",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "var(--sp-5)",
      }}
    >
      {denied ? (
        <GlassButton onClick={onRecenter}>
          <Glyph icon={LocateOff} size={16} />
          {c.locationOff}
        </GlassButton>
      ) : null}
      <GlassButton shape="circle" label={c.recenter} onClick={onRecenter}>
        <Glyph icon={LocateFixed} />
      </GlassButton>
    </div>
  );
}

/** The one primary action on the map: paste a Reel. */
export function PasteFab({ onPaste }: { onPaste: () => void }) {
  const c = useCopy(shellCopy);
  return (
    <IconButton
      variant="cobalt"
      size="xl"
      label={c.paste}
      onClick={onPaste}
      style={{ position: "absolute", right: "var(--sp-7)", bottom: "max(env(safe-area-inset-bottom), var(--sp-7))", zIndex: 1 }}
    >
      <Glyph icon={Plus} size={28} />
    </IconButton>
  );
}
