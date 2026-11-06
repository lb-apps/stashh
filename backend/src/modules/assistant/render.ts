import type { ListSummaryDto } from "../lists/service.js";
import type { SavedPlaceDto } from "../places/service.js";
import { CANCEL_PAYLOAD, confirmPayload, type ConfirmAction, type ReplyInput } from "./tools.js";
import type { PlanButton, PlanCard, PlanMessage, ReplyPlan } from "./types.js";

/**
 * Turns a validated `reply` into the plan the channel sends. Cards go first and the text last,
 * with the quick replies on it: Instagram shows quick replies only on the most recent message.
 */

export interface RenderInput {
  reply: ReplyInput;
  /** The saved places behind `cards.place_ids`, in the model's order; ids it got wrong are left out. */
  places: SavedPlaceDto[];
  /** The lists behind `cards.list_ids`, in the model's order. */
  lists: ListSummaryDto[];
  /** The minted sign-in link when the reply asked for one; null when it could not be minted. */
  mapUrl: string | null;
  /** The language the confirm buttons are written in; the model never writes them. */
  buttonLanguage?: ButtonLanguage;
}

export type ButtonLanguage = "tr" | "en";

/**
 * The confirm / cancel pair for an irreversible action. Fixed titles that say exactly what a tap
 * does, so no text the model was talked into can dress the erase button up as something else.
 */
const CONFIRM_TITLES: Record<ButtonLanguage, Record<ConfirmAction["action"] | "cancel", string>> = {
  tr: { delete_list: "Evet, listeyi sil", remove_place: "Evet, mekânı kaldır", erase_data: "Evet, verilerimi sil", cancel: "Vazgeç" },
  en: { delete_list: "Yes, delete list", remove_place: "Yes, remove place", erase_data: "Yes, erase my data", cancel: "Cancel" },
};

export function confirmQuickReplies(confirm: ConfirmAction, language: ButtonLanguage): Array<{ title: string; payload: string }> {
  const titles = CONFIRM_TITLES[language];
  return [
    { title: titles[confirm.action], payload: confirmPayload(confirm) },
    { title: titles.cancel, payload: CANCEL_PAYLOAD },
  ];
}

/** The button label on the person's map link, understood in either of the channel's languages. */
export const MAP_BUTTON_TITLE = "stashh.me";

export function renderReply({ reply, places, lists, mapUrl, buttonLanguage = "tr" }: RenderInput): ReplyPlan {
  const messages: PlanMessage[] = [];

  if (reply.cards?.kind === "places" && places.length > 0) {
    messages.push({ kind: "carousel", cards: places.map(placeCard) });
  } else if (reply.cards?.kind === "lists" && lists.length > 0) {
    const buttonTitle = reply.cards.button_title;
    messages.push({ kind: "carousel", cards: lists.map((list) => listCard(list, buttonTitle)) });
  }

  const quickReplies = reply.confirm
    ? confirmQuickReplies(reply.confirm, buttonLanguage)
    : reply.quick_replies?.map((item) => ({ title: item.title, payload: item.payload ?? item.title }));
  const last: PlanMessage =
    reply.map_link && mapUrl
      ? { kind: "button", text: reply.text, buttons: [{ type: "web_url", title: MAP_BUTTON_TITLE, url: mapUrl }] }
      : { kind: "text", text: reply.text };
  if (quickReplies && quickReplies.length > 0) last.quick_replies = quickReplies;
  messages.push(last);

  return { messages };
}

/** `★ 4,6 · Kadıköy` — the same card as the recognition reply draws. */
export function placeCard(place: SavedPlaceDto): PlanCard {
  const mapsUrl = place.google_maps_uri ?? googleMapsSearchUrl(place);
  const area = place.district ?? place.short_formatted_address ?? place.address;
  const subtitle = [place.rating == null ? null : `★ ${place.rating.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`, area?.trim() || null]
    .filter(Boolean)
    .join(" · ");
  const buttons: PlanButton[] = [{ type: "web_url", title: "Google Maps", url: mapsUrl }];
  if (place.instagram_username) {
    buttons.push({ type: "web_url", title: "Instagram", url: `https://www.instagram.com/${encodeURIComponent(place.instagram_username)}/` });
  }
  return {
    title: place.name,
    ...(subtitle ? { subtitle } : {}),
    ...(place.thumbnail_url ? { image_url: place.thumbnail_url } : {}),
    url: mapsUrl,
    buttons,
  };
}

export function listCard(list: ListSummaryDto, buttonTitle: string): PlanCard {
  return {
    title: list.emoji ? `${list.emoji} ${list.title}` : list.title,
    subtitle: `${list.place_count} ${list.place_count === 1 ? "mekân" : "mekân"}`,
    buttons: [{ type: "postback", title: buttonTitle, payload: `SHOW_LIST:${list.id}` }],
  };
}

/** Google Maps universal URL pinned to the exact place (https://developers.google.com/maps/documentation/urls). */
function googleMapsSearchUrl(place: SavedPlaceDto): string {
  const params = new URLSearchParams({ api: "1", query: place.name });
  if (place.google_place_id) params.set("query_place_id", place.google_place_id);
  return `https://www.google.com/maps/search/?${params}`;
}
