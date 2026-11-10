import { publicEnv } from "@/lib/env";
import type { LatLng } from "@/lib/stashh/types";

/** The Static Images API cannot draw the live map's Standard style; Streets is its closest match. */
const STYLE = "mapbox/streets-v12";
/** Close enough to read a neighbourhood's streets, far enough to see where it sits. */
const NEIGHBOURHOOD_ZOOM = 13;
/** Four decimals is about 11 m: finer only changes the URL, and so misses the browser cache. */
const COORDINATE_DIGITS = 4;

/**
 * A map as a plain image, for thumbnails where a live map would cost a WebGL
 * context each. Points of interest are filtered out so the streets read at this
 * size. The credit is not burned into the image: whoever shows one shows `MapCredit`.
 */
export function staticMapUrl(centre: LatLng, width: number, height: number, zoom = NEIGHBOURHOOD_ZOOM): string {
  const position = `${centre.longitude.toFixed(COORDINATE_DIGITS)},${centre.latitude.toFixed(COORDINATE_DIGITS)},${zoom}`;
  const query = new URLSearchParams({
    attribution: "false",
    logo: "false",
    setfilter: JSON.stringify(["==", "class", "none"]),
    layer_id: "poi-label",
    access_token: publicEnv.mapboxToken,
  });
  return `https://api.mapbox.com/styles/v1/${STYLE}/static/${position}/${width}x${height}@2x?${query}`;
}
