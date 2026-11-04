import { describe, expect, it } from "vitest";
import { buildContextBlock } from "../src/modules/assistant/context.js";
import { MAP_BUTTON_TITLE, renderReply } from "../src/modules/assistant/render.js";
import type { ListSummaryDto } from "../src/modules/lists/service.js";
import type { SavedPlaceDto } from "../src/modules/places/service.js";

const place = (overrides: Partial<SavedPlaceDto> = {}): SavedPlaceDto =>
  ({
    id: "22222222-2222-4222-8222-222222222222",
    google_place_id: "ChIJ-x",
    name: "Ali Usta",
    address: "Mithatpaşa Cd. 1153",
    short_formatted_address: "Üçkuyular, İzmir",
    city: "İzmir",
    district: "Karabağlar",
    country: "TR",
    location: null,
    category: "restaurant",
    category_group: "food",
    rating: 4.6,
    rating_count: 1200,
    price_level: 2,
    thumbnail_url: "https://cdn.stashh.me/t/1.jpg",
    website_url: null,
    phone_number: null,
    google_maps_uri: "https://maps.google.com/?cid=1",
    business_status: null,
    types: null,
    opening_hours: null,
    utc_offset_minutes: 180,
    instagram_username: "aliusta",
    recommendations: [],
    notes: null,
    saved_at: "2026-11-01T10:00:00Z",
    list_ids: [],
    visited_at: null,
    source: null,
    ...overrides,
  }) as SavedPlaceDto;

const list = (overrides: Partial<ListSummaryDto> = {}): ListSummaryDto => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "İzmir",
  description: null,
  emoji: "🌊",
  cover_category: null,
  created_at: "t",
  updated_at: "t",
  place_count: 7,
  ...overrides,
});

describe("renderReply", () => {
  it("puts the text with its quick replies last, after the cards", () => {
    const plan = renderReply({
      reply: { text: "İşte.", quick_replies: [{ title: "Listeye koy" }, { title: "Haritamı aç", payload: "OPEN_MAP" }], cards: { kind: "places", place_ids: ["x"] } },
      places: [place()],
      lists: [],
      mapUrl: null,
    });
    expect(plan.messages.map((m) => m.kind)).toEqual(["carousel", "text"]);
    expect(plan.messages[1]).toEqual({
      kind: "text",
      text: "İşte.",
      quick_replies: [
        { title: "Listeye koy", payload: "Listeye koy" },
        { title: "Haritamı aç", payload: "OPEN_MAP" },
      ],
    });
    const card = (plan.messages[0] as { cards: Array<Record<string, unknown>> }).cards[0]!;
    expect(card).toMatchObject({ title: "Ali Usta", subtitle: "★ 4,6 · Karabağlar", image_url: "https://cdn.stashh.me/t/1.jpg", url: "https://maps.google.com/?cid=1" });
    expect(card["buttons"]).toEqual([
      { type: "web_url", title: "Google Maps", url: "https://maps.google.com/?cid=1" },
      { type: "web_url", title: "Instagram", url: "https://www.instagram.com/aliusta/" },
    ]);
  });

  it("draws list cards with a postback button in the model's words", () => {
    const plan = renderReply({ reply: { text: "Listelerin:", cards: { kind: "lists", list_ids: ["l"], button_title: "Mekânları gör" } }, places: [], lists: [list()], mapUrl: null });
    expect(plan.messages[0]).toEqual({
      kind: "carousel",
      cards: [{ title: "🌊 İzmir", subtitle: "7 mekân", buttons: [{ type: "postback", title: "Mekânları gör", payload: "SHOW_LIST:11111111-1111-4111-8111-111111111111" }] }],
    });
  });

  it("attaches the map link as a button message and drops it when none could be minted", () => {
    const withLink = renderReply({ reply: { text: "Haritan:", map_link: true }, places: [], lists: [], mapUrl: "https://stashh.me/app/a/abc" });
    expect(withLink.messages).toEqual([{ kind: "button", text: "Haritan:", buttons: [{ type: "web_url", title: MAP_BUTTON_TITLE, url: "https://stashh.me/app/a/abc" }] }]);

    const without = renderReply({ reply: { text: "Haritan:", map_link: true }, places: [], lists: [], mapUrl: null });
    expect(without.messages).toEqual([{ kind: "text", text: "Haritan:" }]);
  });

  it("sends only the text when the cards resolved to nothing", () => {
    const plan = renderReply({ reply: { text: "Bulamadım.", cards: { kind: "places", place_ids: ["x"] } }, places: [], lists: [], mapUrl: null });
    expect(plan.messages).toEqual([{ kind: "text", text: "Bulamadım." }]);
  });
});

describe("buildContextBlock", () => {
  it("names the lists with ids and the recent shares with place ids", () => {
    const block = buildContextBlock({
      profile: { username: "emir", displayName: "Emir" },
      savedCount: 12,
      lists: [list(), list({ id: "l2", title: "Kahveciler", emoji: null, place_count: 1 })],
      recentRecognitions: [
        {
          recognition_id: "r1",
          at: "2026-11-04T11:48:00Z",
          source_type: "reel",
          author_username: "izmirdeyiz",
          places: [{ place_id: "p1", name: "Ali Usta" }, { place_id: null, name: "Bilinmeyen" }],
        },
      ],
      now: new Date("2026-11-04T12:00:00Z"),
    });
    expect(block).toContain("Instagram: Emir @emir");
    expect(block).toContain("Saved places: 12");
    expect(block).toContain("🌊 İzmir · 7 places · list_id 11111111-1111-4111-8111-111111111111");
    expect(block).toContain("Kahveciler · 1 place · list_id l2");
    expect(block).toContain("12 min ago: Reel by @izmirdeyiz → Ali Usta (place_id p1), Bilinmeyen · recognition_id r1");
    expect(block).toContain("Now: 2026-11-04T12:00:00.000Z");
  });

  it("says when there is nothing yet", () => {
    const block = buildContextBlock({ profile: null, savedCount: 0, lists: [], recentRecognitions: [], now: new Date() });
    expect(block).toContain("profile not read yet");
    expect(block).toContain("Lists: none yet");
    expect(block).toContain("Recent shares: none yet");
  });
});
