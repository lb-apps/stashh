import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/discovery/categories";
import { Glyph } from "@/lib/discovery/components/Glyph";
import { MAP_PIN } from "@/lib/discovery/components/MapPin";
import { colorToken } from "@/lib/discovery/token-values";
import { CATEGORY_GLYPH } from "../places/category-glyph";

/**
 * Map pins as GL images — Discovery's `MapPin` (unselected) drawn on a canvas,
 * one per category, so the map draws every pin in its own frame and the
 * Liquid Glass refracts them. The selected pin is the DOM `MapPin`, with label.
 *
 * Geometry is MapPin's own (`MAP_PIN`): category disc, white ring, white
 * glyph, the `--sh-pin` shadow.
 */
const { disc: DISC, ring: RING, glyph: GLYPH } = MAP_PIN;
const SCALE = 2;

function rgba([r, g, b, a]: [number, number, number, number]) {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

/** First layer of `--sh-pin`: `x y blur color`. */
function pinShadow(): { y: number; blur: number; color: string } {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sh-pin").trim();
  const m = /^([-\d.]+)px\s+([-\d.]+)px\s+([-\d.]+)px\s+(rgba?\([^)]+\))/.exec(raw);
  return m ? { y: Number(m[2]), blur: Number(m[3]), color: m[4] } : { y: 0, blur: 0, color: "transparent" };
}

function glyphImage(category: PlaceCategory, color: string): Promise<HTMLImageElement> {
  const svg = renderToStaticMarkup(createElement(Glyph, { icon: CATEGORY_GLYPH[category], size: GLYPH, color }));
  const image = new Image();
  // A data-URI SVG must be standalone XML: it needs the namespace (Lucide already emits it — adding a second is invalid).
  const standalone = svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(standalone)}`;
  return image.decode().then(() => image);
}

export interface PinImage {
  id: string;
  data: ImageData;
  pixelRatio: number;
}

export const pinImageId = (category: PlaceCategory) => `pin-${category}`;

export async function drawPinImages(): Promise<PinImage[]> {
  const shadow = pinShadow();
  const white = rgba(colorToken("--white"));
  const pad = Math.ceil(shadow.blur + Math.abs(shadow.y));
  const size = DISC + RING * 2 + pad * 2;

  return Promise.all(
    PLACE_CATEGORIES.map(async (category) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size * SCALE;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(SCALE, SCALE);
      const c = size / 2;

      ctx.save();
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetY = shadow.y;
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.arc(c, c, DISC / 2 + RING, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = rgba(colorToken(`--pin-${category}`));
      ctx.beginPath();
      ctx.arc(c, c, DISC / 2, 0, Math.PI * 2);
      ctx.fill();

      const glyph = await glyphImage(category, white);
      ctx.drawImage(glyph, c - GLYPH / 2, c - GLYPH / 2, GLYPH, GLYPH);

      return { id: pinImageId(category), data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: SCALE };
    }),
  );
}

/** Pin hit radius in CSS px, for the map's tap tolerance. */
export const PIN_RADIUS = DISC / 2 + RING;
