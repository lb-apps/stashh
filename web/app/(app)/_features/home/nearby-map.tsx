"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Navigation } from "lucide-react";
import { track } from "@/lib/analytics/analytics";
import { GlassButton } from "@/lib/discovery/components/Glass";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { GlassProvider } from "@/lib/discovery/glass";
import { useLiquidGlass } from "@/lib/discovery/liquid-glass/use-liquid-glass";
import { useCopy } from "@/lib/i18n/provider";
import { useLocation } from "@/lib/platform/location";
import type { SavedPlace } from "@/lib/stashh/types";
import type { MapHandle } from "../map/map-view";
import { useSheetNav } from "../shell/sheet-state";
import { homeCopy } from "./copy";

// The map and its WebGL code load only when the Nearby tab opens.
const MapView = dynamic(() => import("../map/map-view").then((m) => m.MapView), { ssr: false });

/** About half the screen, as on the first home design, within bounds for small and tall phones. */
const MAP_HEIGHT = "clamp(280px, 48svh, 460px)";

/**
 * The live map at the top of the Nearby tab: every visible place as a pin, a
 * tap on one opens it, and a glass button brings the map back to the reader.
 * Edge to edge, with Mapbox's logo and credit on it. Without WebGL it steps aside.
 */
export function NearbyMap({ places }: { places: SavedPlace[] }) {
  const copy = useCopy(homeCopy);
  const { open } = useSheetNav();
  const location = useLocation();
  const { glass, registry, onBackdropReady, onBackdropLost } = useLiquidGlass();
  const mapRef = React.useRef<MapHandle>(null);
  const [unavailable, setUnavailable] = React.useState(false);

  if (unavailable) return null;
  const position = location.state.status === "granted" ? location.state.position : null;
  const recenter = async () => {
    const point = position ?? (await location.locate());
    if (point) mapRef.current?.centre(point);
  };

  return (
    <div
      style={{
        position: "relative",
        height: MAP_HEIGHT,
        // Full bleed under the tab bar: out of the page's gutter and its top padding.
        margin: "calc(-1 * var(--sp-4)) calc(-1 * var(--gutter)) 0",
        overflow: "hidden",
        background: "var(--bone-200)",
      }}
    >
      <MapView
        ref={mapRef}
        places={places}
        selectedId={null}
        onSelect={(placeId) => {
          if (!placeId) return;
          track("place_viewed", { entry: "map_pin" });
          open({ name: "place", placeId });
        }}
        dropping={[]}
        onDropped={() => {}}
        bottomInset={0}
        userLocation={position}
        glass={glass}
        onGlassReady={onBackdropReady}
        onGlassLost={onBackdropLost}
        onUnavailable={() => {
          onBackdropLost();
          setUnavailable(true);
        }}
      />
      <GlassProvider value={registry}>
        <GlassButton
          shape="circle"
          label={copy.recenter}
          onClick={() => void recenter()}
          style={{ position: "absolute", top: "var(--sp-7)", right: "var(--sp-7)" }}
        >
          <Glyph icon={Navigation} fill="currentColor" />
        </GlassButton>
      </GlassProvider>
    </div>
  );
}
