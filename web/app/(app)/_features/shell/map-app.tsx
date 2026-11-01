"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Search, UserRound } from "lucide-react";
import { DetentSheet } from "@/lib/discovery/components/DetentSheet";
import { GlassButton, GlassSurface } from "@/lib/discovery/components/Glass";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { GlassProvider } from "@/lib/discovery/glass";
import { useLiquidGlass } from "@/lib/discovery/liquid-glass/use-liquid-glass";
import { useElementSize } from "@/lib/discovery/use-element-size";
import { useT } from "@/lib/i18n/provider";
import { usePlaces } from "@/lib/stashh/queries";
import type { MapHandle } from "../map/map-view";
import { initialSheetState, reduceSheet } from "./sheet-state";

// The map (and its ~1 MB of WebGL code) loads after the shell has painted.
const MapView = dynamic(() => import("../map/map-view").then((m) => m.MapView), { ssr: false });

/** Home peek: 60% of the screen, never under 400px, never closer than 96px to the top. */
const homePeek = (h: number) => Math.min(Math.max(h * 0.6, 400), h - 96);

/**
 * The app: a live map with glass chrome on top and one sheet at a time.
 * Screens are composed from shared parts; this file only wires them together.
 */
export function MapApp() {
  const t = useT();
  const [sheet, dispatch] = React.useReducer(reduceSheet, initialSheetState);
  const places = usePlaces();
  const { glass, registry, onBackdropReady, onBackdropLost } = useLiquidGlass();
  const [rootRef, root] = useElementSize<HTMLDivElement>();
  const mapRef = React.useRef<MapHandle>(null);
  const count = places.data?.length ?? 0;

  const selectedId = sheet.route.name === "place" ? sheet.route.placeId : null;
  const bottomInset = root && sheet.detent === "peek" ? homePeek(root.height) : 0;

  const select = (placeId: string | null) => {
    if (!placeId) {
      dispatch({ type: "home" });
      return;
    }
    dispatch({ type: "open", route: { name: "place", placeId } });
    const place = places.data?.find((p) => p.id === placeId);
    if (place) mapRef.current?.focus(place);
  };

  return (
    <div ref={rootRef} style={{ position: "absolute", inset: 0 }}>
      <MapView
        ref={mapRef}
        places={places.data ?? []}
        selectedId={selectedId}
        onSelect={select}
        dropping={sheet.justSaved}
        onDropped={() => dispatch({ type: "celebrated" })}
        bottomInset={bottomInset}
        userLocation={null}
        glass={glass}
        onGlassReady={onBackdropReady}
        onGlassLost={onBackdropLost}
        onUnavailable={onBackdropLost}
      />

      <GlassProvider value={registry}>
        <header
          className="app-inset-top"
          style={{
            position: "absolute",
            insetInline: 0,
            top: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--sp-6)",
            paddingInline: "var(--sp-7)",
            pointerEvents: "none",
          }}
        >
          <GlassSurface style={{ padding: "var(--sp-5) var(--sp-8) var(--sp-6)", pointerEvents: "auto" }}>
            <div className="ds-display-1">Stashh</div>
            <div className="ds-micro" style={{ color: "var(--text-secondary)" }}>
              {count ? t.home.savedCount(count) : t.home.nothingSaved}
            </div>
          </GlassSurface>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", pointerEvents: "auto" }}>
            <GlassButton shape="circle" label={t.common.search} onClick={() => dispatch({ type: "open", route: { name: "search" } })}>
              <Glyph icon={Search} />
            </GlassButton>
            <GlassButton shape="circle" label={t.common.profile} onClick={() => dispatch({ type: "open", route: { name: "profile" } })}>
              <Glyph icon={UserRound} />
            </GlassButton>
          </div>
        </header>
      </GlassProvider>

      <DetentSheet
        aria-label="Stashh"
        detent={sheet.detent}
        onDetentChange={(detent) => dispatch({ type: "detent", detent })}
        peekHeight={homePeek}
        onDismiss={sheet.route.name === "home" ? undefined : () => dispatch({ type: "home" })}
        onCoverChange={(px) => document.documentElement.style.setProperty("--sheet-cover", `${px}px`)}
      >
        <div style={{ padding: "0 var(--gutter) var(--sp-9)" }}>
          {places.data?.map((p) => (
            <button
              key={p.id}
              type="button"
              className="ds-body"
              onClick={() => select(p.id)}
              style={{ display: "flex", alignItems: "center", width: "100%", minHeight: "var(--hit-min)", border: "none", background: "none", padding: 0, textAlign: "start" }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </DetentSheet>
    </div>
  );
}
