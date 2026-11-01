"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { GeoJSONSource, Map as MapboxMap, Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MAP_PIN, MapPin } from "@/lib/discovery/components/MapPin";
import type { LiquidGlass } from "@/lib/discovery/liquid-glass/liquid-glass";
import { motionToken } from "@/lib/discovery/token-values";
import { publicEnv } from "@/lib/env";
import type { LatLng, SavedPlace } from "@/lib/stashh/types";
import { CATEGORY_GLYPH } from "../places/category-glyph";
import { drawPinImages, pinImageId, PIN_RADIUS } from "./pin-images";
import { DroppingPins } from "./dropping-pins";

export interface MapHandle {
  /** Centres a place, clear of the sheet. */
  focus: (place: SavedPlace) => void;
  /** Centres a coordinate (the reader's location). */
  centre: (point: LatLng) => void;
}

interface MapViewProps {
  places: SavedPlace[];
  selectedId: string | null;
  onSelect: (placeId: string | null) => void;
  /** Library ids whose pins drop in from above (just saved). */
  dropping: string[];
  onDropped: () => void;
  /** How much of the bottom the sheet covers at rest; the camera stays clear of it. */
  bottomInset: number;
  userLocation: LatLng | null;
  glass: LiquidGlass;
  onGlassReady: () => void;
  onGlassLost: () => void;
  /** No WebGL, or the map failed to start: the app falls back to its list. */
  onUnavailable: () => void;
  ref?: React.Ref<MapHandle>;
}

/** Launch market, used only when the reader has nothing saved yet. */
const FALLBACK_CENTRE: [number, number] = [29.0275, 41.0082];

const SOURCE = "stashh-places";
const PIN_LAYER = "stashh-pins";

function toFeatures(places: SavedPlace[], hidden: ReadonlySet<string>) {
  return {
    type: "FeatureCollection" as const,
    features: places
      .filter((p) => p.location && !hidden.has(p.id))
      .map((p) => ({
        type: "Feature" as const,
        id: p.id,
        properties: { id: p.id, icon: pinImageId(p.category_group) },
        geometry: { type: "Point" as const, coordinates: [p.location!.longitude, p.location!.latitude] },
      })),
  };
}

/**
 * The live map (Mapbox GL JS, Standard style — the closest to Apple Maps).
 * Pins are GL symbols so the Liquid Glass refracts them; the selected pin and
 * the pins dropping in are DOM `MapPin`s, which carry a label and animate.
 */
export function MapView({
  places,
  selectedId,
  onSelect,
  dropping,
  onDropped,
  bottomInset,
  userLocation,
  glass,
  onGlassReady,
  onGlassLost,
  onUnavailable,
  ref,
}: MapViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<MapboxMap | null>(null);
  /** Set once the style, pins and glass are in: the map is ready to use. */
  const [readyMap, setReadyMap] = React.useState<MapboxMap | null>(null);
  const ready = readyMap !== null;
  const [markerHost, setMarkerHost] = React.useState<{ selected: HTMLElement; user: HTMLElement } | null>(null);
  const markers = React.useRef<{ selected: Marker; user: Marker } | null>(null);
  const onSelectEvent = React.useEffectEvent(onSelect);
  const onUnavailableEvent = React.useEffectEvent(onUnavailable);
  const onGlassReadyEvent = React.useEffectEvent(onGlassReady);
  const onGlassLostEvent = React.useEffectEvent(onGlassLost);
  const initialPlaces = React.useEffectEvent(() => places);

  // Create the map once.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let map: MapboxMap | null = null;

    (async () => {
      const { default: mapboxgl } = await import("mapbox-gl");
      if (disposed) return;

      const start = initialPlaces().filter((p) => p.location);
      try {
        mapboxgl.accessToken = publicEnv.mapboxToken;
        map = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/standard",
          config: {
            basemap: {
              lightPreset: "day",
              theme: "faded",
              showPointOfInterestLabels: false,
              showTransitLabels: false,
            },
          },
          center: start[0]?.location ? [start[0].location.longitude, start[0].location.latitude] : FALLBACK_CENTRE,
          zoom: 13.5,
          pitch: 0,
          // Logo and attribution are required by Mapbox's terms; they ride just above the sheet.
          attributionControl: false,
          logoPosition: "bottom-left",
          maxTileCacheSize: 200,
          cooperativeGestures: false,
          pitchWithRotate: false,
          dragRotate: false,
        });
      } catch {
        onUnavailableEvent();
        return;
      }
      mapRef.current = map;
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      map.touchZoomRotate.disableRotation();

      const selectedEl = document.createElement("div");
      const userEl = document.createElement("div");
      markers.current = {
        selected: new mapboxgl.Marker({ element: selectedEl, anchor: "top" }),
        user: new mapboxgl.Marker({ element: userEl }),
      };
      setMarkerHost({ selected: selectedEl, user: userEl });

      map.on("style.load", async () => {
        if (!map) return;
        // Pins are decoration on a working map: if their images fail, the map, glass and selection still load.
        const images = await drawPinImages().catch((error: unknown) => {
          console.error("Map pin images failed", error);
          return [];
        });
        if (!map) return;
        for (const image of images) {
          if (!map.hasImage(image.id)) map.addImage(image.id, image.data, { pixelRatio: image.pixelRatio });
        }
        map.addSource(SOURCE, { type: "geojson", data: toFeatures(initialPlaces(), new Set()) });
        map.addLayer({
          id: PIN_LAYER,
          type: "symbol",
          source: SOURCE,
          slot: "top",
          layout: {
            "icon-image": ["get", "icon"],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
        map.addLayer(glass.layer as unknown as Parameters<MapboxMap["addLayer"]>[0]);
        glass.attach(map.getCanvas(), () => map?.triggerRepaint());
        onGlassReadyEvent();

        if (start.length > 1) {
          const lngs = start.map((p) => p.location!.longitude);
          const lats = start.map((p) => p.location!.latitude);
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: PIN_RADIUS * 3, maxZoom: 15, duration: 0 },
          );
        }
        setReadyMap(map);
      });

      map.on("click", (event) => {
        if (!map) return;
        const hit = map.queryRenderedFeatures(
          [
            [event.point.x - PIN_RADIUS, event.point.y - PIN_RADIUS],
            [event.point.x + PIN_RADIUS, event.point.y + PIN_RADIUS],
          ],
          { layers: [PIN_LAYER] },
        )[0];
        onSelectEvent(hit ? String(hit.properties?.id) : null);
      });

      map.on("webglcontextlost", () => {
        glass.detach();
        onGlassLostEvent();
      });
      map.on("error", (event) => {
        if (String(event.error?.message ?? "").includes("WebGL")) onUnavailableEvent();
      });
    })();

    return () => {
      disposed = true;
      glass.detach();
      markers.current?.selected.remove();
      markers.current?.user.remove();
      markers.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, [glass]);

  // Keep the pin source in step with the library (dropping pins are drawn as DOM until they land).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const hidden = new Set([...dropping, ...(selectedId ? [selectedId] : [])]);
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toFeatures(places, hidden));
  }, [ready, places, dropping, selectedId]);

  // The selected pin: a DOM MapPin with its label, anchored on the place.
  const selected = selectedId ? places.find((p) => p.id === selectedId) : undefined;
  React.useEffect(() => {
    const map = mapRef.current;
    const marker = markers.current?.selected;
    if (!ready || !map || !marker) return;
    if (selected?.location) {
      // Anchor at the top of the element, lifted by half a disc so the disc centres on the point.
      marker.setOffset([0, -MAP_PIN.discSelected / 2]).setLngLat([selected.location.longitude, selected.location.latitude]).addTo(map);
    } else {
      marker.remove();
    }
  }, [ready, selected]);

  React.useEffect(() => {
    const map = mapRef.current;
    const marker = markers.current?.user;
    if (!ready || !map || !marker) return;
    if (userLocation) marker.setLngLat([userLocation.longitude, userLocation.latitude]).addTo(map);
    else marker.remove();
  }, [ready, userLocation]);

  React.useEffect(() => {
    mapRef.current?.setPadding({ top: 0, left: 0, right: 0, bottom: bottomInset });
  }, [ready, bottomInset]);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: (place) => {
        if (!place.location) return;
        const { duration } = motionToken("--dur-sheet", "--ease-out");
        mapRef.current?.easeTo({
          center: [place.location.longitude, place.location.latitude],
          zoom: Math.max(mapRef.current.getZoom(), 15),
          duration: duration * 1000,
        });
      },
      centre: (point) => {
        const { duration } = motionToken("--dur-sheet", "--ease-out");
        mapRef.current?.easeTo({ center: [point.longitude, point.latitude], zoom: 15, duration: duration * 1000 });
      },
    }),
    [],
  );

  return (
    <>
      <div ref={containerRef} className="app-map" style={{ position: "absolute", inset: 0, background: "var(--bone-200)", touchAction: "none" }} />
      {markerHost && selected
        ? createPortal(
            <MapPin
              category={selected.category_group}
              selected
              label={selected.name}
              glyph={<Glyph icon={CATEGORY_GLYPH[selected.category_group]} size={MAP_PIN.glyphSelected} />}
              onClick={() => onSelect(null)}
            />,
            markerHost.selected,
          )
        : null}
      {markerHost && userLocation ? createPortal(<UserDot />, markerHost.user) : null}
      {readyMap && dropping.length ? (
        <DroppingPins map={readyMap} places={places.filter((p) => dropping.includes(p.id))} onLanded={onDropped} />
      ) : null}
    </>
  );
}

/** The reader's location: a cobalt dot in a white ring with a soft cobalt halo. */
function UserDot() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: "var(--sp-8)",
        height: "var(--sp-8)",
        borderRadius: "var(--r-circle)",
        background: "var(--cobalt-500)",
        boxShadow: "0 0 0 var(--sp-2) var(--white), 0 0 0 var(--sp-6) var(--cobalt-tint-14)",
      }}
    />
  );
}
