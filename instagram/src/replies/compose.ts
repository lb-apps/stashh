import { LIMITS, type CarouselCard, type OutboundMessage, type QuickReply } from "../meta/graph-client.ts";
import type { Place, PlanMessage, ReplyPlan } from "../stashh/client.ts";
import { copy, type SourceKind } from "./copy.tr.ts";

/** The payloads the recognition reply's quick replies carry; the assistant knows both. */
export const ADD_TO_LIST_PAYLOAD = (recognitionId: string) => `ADD_TO_LIST:${recognitionId}`;
export const OPEN_MAP_PAYLOAD = "OPEN_MAP";

export interface RecognitionReplyOptions {
  /** The person's sign-in link, for the map button under the summary. */
  mapUrl?: string | null;
  /** With `suggestedReplies`, "Listeye koy" carries this id to the assistant. */
  recognitionId?: string | null;
  /** Quick replies under the summary (`RECOGNITION_SUGGESTED_REPLIES`); off, people write what they want. */
  suggestedReplies?: boolean;
  /** A shared feed post read from one page while more venues sit on the others: the summary asks for its link. */
  morePagesNeeded?: boolean;
}

/**
 * The reply to a finished recognition: the places as carousels, then a one-line summary that
 * carries the person's map button (their sign-in link). The summary comes last because, when
 * suggested replies are on, Instagram shows its quick replies only under the most recent message.
 */
export function composeRecognitionReply(places: Place[], kind: SourceKind, options: RecognitionReplyOptions = {}): OutboundMessage[] {
  if (places.length === 0) return [{ kind: "text", text: copy.empty(kind) }];
  const { mapUrl = null, recognitionId = null, suggestedReplies = false, morePagesNeeded = false } = options;

  const cards = places.map(toCard);
  const carousels: OutboundMessage[] = [];
  for (let i = 0; i < cards.length; i += LIMITS.templateElements) {
    carousels.push({ kind: "carousel", cards: cards.slice(i, i + LIMITS.templateElements) });
  }

  const quickReplies: QuickReply[] = [];
  if (suggestedReplies && recognitionId) quickReplies.push({ title: copy.addToList, payload: ADD_TO_LIST_PAYLOAD(recognitionId) });
  if (suggestedReplies && !mapUrl) quickReplies.push({ title: copy.openMyMapQuick, payload: OPEN_MAP_PAYLOAD });

  const text = morePagesNeeded ? copy.foundSomeNeedsLink(places.length) : copy.found(places.length, kind);
  const taps = quickReplies.length > 0 ? { quickReplies } : {};
  const summary: OutboundMessage = mapUrl
    ? { kind: "button", text, buttons: [{ type: "web_url", title: copy.openMyMap, url: mapUrl }], ...taps }
    : { kind: "text", text, ...taps };
  return [...carousels, summary];
}

/** `text` with the button that opens the person's map through their sign-in link. */
export function mapLinkMessage(text: string, mapUrl: string): OutboundMessage {
  return { kind: "button", text, buttons: [{ type: "web_url", title: copy.openMyMap, url: mapUrl }] };
}

/** The assistant's plan as the Graph client sends it; the backend already ordered the messages. */
export function renderPlan(plan: ReplyPlan): OutboundMessage[] {
  return plan.messages.map(renderPlanMessage);
}

function renderPlanMessage(message: PlanMessage): OutboundMessage {
  if (message.kind === "carousel") {
    return {
      kind: "carousel",
      cards: message.cards.map((card) => ({
        title: card.title,
        ...(card.subtitle ? { subtitle: card.subtitle } : {}),
        ...(card.image_url ? { imageUrl: card.image_url } : {}),
        ...(card.url ? { url: card.url } : {}),
        buttons: card.buttons,
      })),
    };
  }
  const quickReplies = message.quick_replies?.length ? { quickReplies: message.quick_replies } : {};
  if (message.kind === "button") return { kind: "button", text: message.text, buttons: message.buttons, ...quickReplies };
  return { kind: "text", text: message.text, ...quickReplies };
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
      { type: "web_url", title: copy.openInMaps, url: mapsUrl },
      ...(place.instagram_username
        ? [{ type: "web_url" as const, title: copy.instagram, url: `https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/` }]
        : []),
    ],
  };
}

/** Google Maps universal URL pinned to the exact place (https://developers.google.com/maps/documentation/urls). */
function googleMapsUrl(place: Place): string {
  const params = new URLSearchParams({ api: "1", query: place.name, query_place_id: place.google_place_id });
  return `https://www.google.com/maps/search/?${params}`;
}
