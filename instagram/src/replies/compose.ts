import { LIMITS, type CarouselCard, type OutboundMessage } from "../meta/graph-client.ts";
import type { Place } from "../stashh/client.ts";
import { copy, type SourceKind } from "./copy.tr.ts";

/**
 * The reply to a finished recognition: a one-line summary, then the places as carousels.
 * With `mapUrl` (the person's sign-in link) the summary carries a button to their map,
 * where the places were just saved.
 */
export function composeRecognitionReply(places: Place[], kind: SourceKind, mapUrl: string | null = null): OutboundMessage[] {
  if (places.length === 0) return [{ kind: "text", text: copy.empty(kind) }];

  const cards = places.map(toCard);
  const carousels: OutboundMessage[] = [];
  for (let i = 0; i < cards.length; i += LIMITS.templateElements) {
    carousels.push({ kind: "carousel", cards: cards.slice(i, i + LIMITS.templateElements) });
  }
  const summary = copy.found(places.length, kind);
  return [mapUrl ? mapLinkMessage(summary, mapUrl) : { kind: "text", text: summary }, ...carousels];
}

/** `text` with the button that opens the person's map through their sign-in link. */
export function mapLinkMessage(text: string, mapUrl: string): OutboundMessage {
  return { kind: "button", text, buttons: [{ title: copy.openMyMap, url: mapUrl }] };
}

export function toCard(place: Place): CarouselCard {
  const mapsUrl = googleMapsUrl(place);
  const subtitle = [place.rating == null ? null : copy.rating(place.rating), place.address?.trim() || null]
    .filter(Boolean)
    .join(" · ");

  return {
    title: place.name,
    ...(subtitle ? { subtitle } : {}),
    ...(place.thumbnail_url ? { imageUrl: place.thumbnail_url } : {}),
    url: mapsUrl,
    buttons: [
      { title: copy.openInMaps, url: mapsUrl },
      ...(place.instagram_username
        ? [{ title: copy.instagram, url: `https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/` }]
        : []),
    ],
  };
}

/** Google Maps universal URL pinned to the exact place (https://developers.google.com/maps/documentation/urls). */
function googleMapsUrl(place: Place): string {
  const params = new URLSearchParams({ api: "1", query: place.name, query_place_id: place.google_place_id });
  return `https://www.google.com/maps/search/?${params}`;
}
