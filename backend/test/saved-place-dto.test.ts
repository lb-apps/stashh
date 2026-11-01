import { describe, expect, it } from "vitest";
import { toSavedPlaceRecord, type PlaceRow, type SavedPlaceRow } from "../src/modules/places/repository.js";
import { toSavedPlaceDto } from "../src/modules/places/service.js";

function placeRow(overrides: Partial<PlaceRow> = {}): PlaceRow {
  return {
    id: "place-1",
    google_place_id: "ChIJ-1",
    name: "Kronotrop",
    address: "Firuzağa, Cihangir",
    short_formatted_address: null,
    city: "İstanbul",
    district: "Beyoğlu",
    country: "Türkiye",
    location: { latitude: 41.03, longitude: 28.98 },
    geo_location: null,
    category: "coffee_shop",
    rating: 4.6,
    rating_count: 1200,
    price_level: 2,
    thumbnail_url: null,
    website_url: null,
    phone_number: null,
    google_maps_uri: null,
    business_status: "operational",
    types: ["coffee_shop", "cafe"],
    opening_hours: null,
    utc_offset_minutes: 180,
    instagram_username: null,
    recommendations: [],
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function savedRow(overrides: Partial<SavedPlaceRow> = {}): SavedPlaceRow {
  return {
    id: "saved-1",
    owner_user_id: "user-1",
    place_id: "place-1",
    notes: null,
    source_recognition_task_id: null,
    created_at: "2026-10-20T10:00:00Z",
    updated_at: "2026-10-20T10:00:00Z",
    ...overrides,
  };
}

/** A row as PostgREST returns it for SAVED_PLACE_SELECT. */
function selectRow(extra: Record<string, unknown> = {}) {
  return { ...savedRow(), places: placeRow(), list_places: [], user_visits: [], recognition_tasks: null, ...extra };
}

describe("toSavedPlaceDto", () => {
  it("adds the owner's lists, latest visit and the place's category group", () => {
    const dto = toSavedPlaceDto(
      toSavedPlaceRecord(
        selectRow({
          list_places: [{ list_id: "list-a" }, { list_id: "list-b" }],
          user_visits: [{ visited_at: "2026-10-21T09:00:00+00:00" }, { visited_at: "2026-10-25T18:30:00+00:00" }],
        }),
      )!,
    );

    expect(dto.id).toBe("place-1");
    expect(dto.list_ids).toEqual(["list-a", "list-b"]);
    expect(dto.visited_at).toBe("2026-10-25T18:30:00+00:00");
    expect(dto.category_group).toBe("coffee");
    expect(dto.utc_offset_minutes).toBe(180);
    expect(dto.source).toBeNull();
    expect(dto).not.toHaveProperty("saved_place_id");
  });

  it("is unvisited and in no list when there are none", () => {
    const dto = toSavedPlaceDto(toSavedPlaceRecord(selectRow({ list_places: null, user_visits: null }))!);
    expect(dto.list_ids).toEqual([]);
    expect(dto.visited_at).toBeNull();
  });

  it("names the post the place was saved from", () => {
    const dto = toSavedPlaceDto(
      toSavedPlaceRecord(
        selectRow({
          recognition_tasks: {
            source_url: "https://instagram.com/reel/DQ1",
            recognition_results: { source_type: "reel", source_thumbnail_url: "https://cdn/x.jpg", author_username: "istanbulfoodie" },
          },
        }),
      )!,
    );
    expect(dto.source).toEqual({
      url: "https://instagram.com/reel/DQ1",
      type: "reel",
      thumbnail_url: "https://cdn/x.jpg",
      author_username: "istanbulfoodie",
    });
  });

  it("has no link for a post shared in a DM, and survives a task whose result is gone", () => {
    const shared = toSavedPlaceDto(
      toSavedPlaceRecord(
        selectRow({
          recognition_tasks: {
            source_url: "instagram-media:1789",
            recognition_results: { source_type: "post", source_thumbnail_url: null, author_username: null },
          },
        }),
      )!,
    );
    expect(shared.source).toEqual({ url: null, type: "post", thumbnail_url: null, author_username: null });

    const orphan = toSavedPlaceDto(
      toSavedPlaceRecord(selectRow({ recognition_tasks: { source_url: "https://www.tiktok.com/@a/video/1", recognition_results: null } }))!,
    );
    expect(orphan.source).toEqual({ url: "https://www.tiktok.com/@a/video/1", type: null, thumbnail_url: null, author_username: null });
  });

  it("rejects a row whose place embed is missing", () => {
    expect(toSavedPlaceRecord(selectRow({ places: null }))).toBeNull();
  });
});
