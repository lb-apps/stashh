import {
  Coffee,
  Croissant,
  IceCreamCone,
  MapPin,
  Martini,
  Mountain,
  ShoppingBasket,
  Sun,
  Trees,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";
import type { PlaceCategory } from "@/lib/discovery/categories";

/** The glyph drawn on a category's pin and disc. */
export const CATEGORY_GLYPH: Record<PlaceCategory, LucideIcon> = {
  coffee: Coffee,
  food: Utensils,
  bar: Martini,
  rooftop: Sun,
  sweets: IceCreamCone,
  bakery: Croissant,
  wine: Wine,
  park: Trees,
  view: Mountain,
  market: ShoppingBasket,
  default: MapPin,
};
