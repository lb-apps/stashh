"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MapPin } from "@/lib/discovery/components/MapPin";
import { motionToken } from "@/lib/discovery/token-values";
import type { SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";

/**
 * The celebration: freshly saved places fall onto the map one after another
 * (staggered by `--dur-instant`) and land with Discovery's spring overshoot.
 * Once the last one lands they hand over to the GL pin layer.
 */
export function DroppingPins({ map, places, onLanded }: { map: MapboxMap; places: SavedPlace[]; onLanded: () => void }) {
  const [hosts, setHosts] = React.useState<Array<{ place: SavedPlace; element: HTMLElement }>>([]);
  const landed = React.useRef(0);

  React.useEffect(() => {
    let markers: Marker[] = [];
    let disposed = false;
    (async () => {
      const { default: mapboxgl } = await import("mapbox-gl");
      if (disposed) return;
      const placed = places.filter((p) => p.location);
      markers = placed.map((p) =>
        new mapboxgl.Marker({ element: document.createElement("div") }).setLngLat([p.location!.longitude, p.location!.latitude]).addTo(map),
      );
      setHosts(placed.map((place, i) => ({ place, element: markers[i].getElement() })));
    })();
    return () => {
      disposed = true;
      markers.forEach((m) => m.remove());
    };
  }, [map, places]);

  const fall = motionToken("--dur-sheet", "--ease-spring");
  const fade = motionToken("--dur", "--ease-out");
  const stagger = motionToken("--dur-instant", "--ease-out").duration;

  return hosts.map(({ place, element }, i) =>
    createPortal(
      <motion.div
        initial={{ y: "-320%", scale: 0.6, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={{ ...fall, delay: i * stagger, opacity: { ...fade, delay: i * stagger } }}
        onAnimationComplete={() => {
          landed.current += 1;
          if (landed.current === hosts.length) onLanded();
        }}
      >
        <MapPin category={place.category_group} glyph={<Glyph icon={CATEGORY_GLYPH[place.category_group]} />} />
      </motion.div>,
      element,
      place.id,
    ),
  );
}
