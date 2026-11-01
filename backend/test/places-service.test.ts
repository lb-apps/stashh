import { describe, expect, it } from "vitest";
import { rootLogger } from "../src/lib/logger.js";
import type { PlacesRepository, PlaceRow, SavedPlaceInsert } from "../src/modules/places/repository.js";
import { PlacesService } from "../src/modules/places/service.js";
import type { RecognitionRepository } from "../src/modules/recognitions/repository.js";
import type { IGooglePlacesClient } from "../src/services/google/google-places-client.js";
import type { IGooglePhotoMediaClient } from "../src/services/google/google-photo-media-client.js";

const OWNER = "user-1";
const RESULT = "11111111-1111-1111-1111-111111111111";

function place(id: string, googlePlaceId: string): PlaceRow {
  return {
    id,
    google_place_id: googlePlaceId,
    name: googlePlaceId,
    address: null,
    short_formatted_address: null,
    city: "İstanbul",
    district: "Kadıköy",
    country: "Türkiye",
    location: { latitude: 41, longitude: 29 },
    geo_location: null,
    category: "cafe",
    rating: null,
    rating_count: null,
    price_level: null,
    thumbnail_url: null,
    website_url: null,
    phone_number: null,
    google_maps_uri: null,
    business_status: null,
    types: null,
    opening_hours: null,
    utc_offset_minutes: 180,
    instagram_username: null,
    recommendations: [],
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

class FakePlacesRepository {
  places = [place("place-a", "g-a"), place("place-b", "g-b")];
  saved: Array<SavedPlaceInsert & { id: string }> = [];
  visits: Array<{ savedPlaceId: string; at: Date }> = [];

  async getPlaceByGooglePlaceId(googlePlaceId: string) {
    return this.places.find((p) => p.google_place_id === googlePlaceId) ?? null;
  }
  async getPlaceById(id: string) {
    return this.places.find((p) => p.id === id) ?? null;
  }
  async tryInsertSavedPlace(row: SavedPlaceInsert) {
    const existing = this.saved.find((s) => s.owner_user_id === row.owner_user_id && s.place_id === row.place_id);
    if (existing) return { row: existing, created: false };
    const inserted = { ...row, id: `saved-${this.saved.length + 1}` };
    this.saved.push(inserted);
    return { row: inserted, created: true };
  }
  async userOwnsPlace(owner: string, placeId: string) {
    return this.saved.some((s) => s.owner_user_id === owner && s.place_id === placeId);
  }
  async getSavedPlaceByCanonicalId(placeId: string, owner: string) {
    const saved = this.saved.find((s) => s.owner_user_id === owner && s.place_id === placeId);
    if (!saved) return null;
    return {
      saved_place: { notes: null, created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z", source_recognition_task_id: null, ...saved },
      place: (await this.getPlaceById(placeId))!,
      list_ids: [],
      visits: this.visits.filter((v) => v.savedPlaceId === saved.id).map((v) => v.at.toISOString()),
      source: null,
    };
  }
  async markVisited(savedPlaceId: string, _owner: string, at: Date) {
    if (!this.visits.some((v) => v.savedPlaceId === savedPlaceId)) this.visits.push({ savedPlaceId, at });
  }
  async clearVisits(savedPlaceId: string) {
    this.visits = this.visits.filter((v) => v.savedPlaceId !== savedPlaceId);
  }
}

const resultPlace = (googlePlaceId: string) => ({
  google_place_id: googlePlaceId,
  name: googlePlaceId,
  address: "",
  location: null,
  rating: null,
  thumbnail_url: null,
  instagram_username: null,
  recommendations: [],
});

class FakeRecognitionRepository {
  async getOwnedRecognitionResult(resultId: string, owner: string) {
    if (resultId !== RESULT || owner !== OWNER) return null;
    return { result: { id: RESULT, places: [resultPlace("g-a"), resultPlace("g-b")] }, taskId: "task-latest" };
  }
}

const google = {
  getPlacePhotos: async () => ["photos/1", "photos/2", "photos/3"],
  getPlaceDetails: async () => null,
} as unknown as IGooglePlacesClient;
const photos = { resolvePhotoUri: async (name: string) => `https://lh3/${name}` } as unknown as IGooglePhotoMediaClient;

function setup() {
  const repo = new FakePlacesRepository();
  const service = new PlacesService(
    repo as unknown as PlacesRepository,
    new FakeRecognitionRepository() as unknown as RecognitionRepository,
    google,
    photos,
    rootLogger,
  );
  return { repo, service };
}

describe("PlacesService.addPlaces from a recognition", () => {
  it("links each saved place to the owner's task that found it", async () => {
    const { repo, service } = setup();
    const { results } = await service.addPlaces(OWNER, { source: "recognition", recognition_result_id: RESULT, place_ids: ["g-a", "g-b"] });

    expect(results.map((r) => r.created)).toEqual([true, true]);
    expect(repo.saved.map((s) => s.source_recognition_task_id)).toEqual(["task-latest", "task-latest"]);
  });

  it("keeps a place's first source when it is saved again", async () => {
    const { repo, service } = setup();
    await service.saveRecognitionPlaces(OWNER, [resultPlace("g-a")], "task-dm");
    const { results } = await service.addPlaces(OWNER, { source: "recognition", recognition_result_id: RESULT, place_ids: ["g-a"] });

    expect(results[0]!.created).toBe(false);
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0]!.source_recognition_task_id).toBe("task-dm");
  });

  it("refuses a result the owner never recognized", async () => {
    const { service } = setup();
    await expect(service.addPlaces("someone-else", { source: "recognition", recognition_result_id: RESULT, place_ids: ["g-a"] })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("PlacesService visits", () => {
  it("marks visited once and unmarks", async () => {
    const { repo, service } = setup();
    await repo.tryInsertSavedPlace({ owner_user_id: OWNER, place_id: "place-a" });

    const first = await service.markVisited(OWNER, "place-a");
    const again = await service.markVisited(OWNER, "place-a");
    expect(first.visited_at).not.toBeNull();
    expect(again.visited_at).toBe(first.visited_at);
    expect(repo.visits).toHaveLength(1);

    expect((await service.clearVisited(OWNER, "place-a")).visited_at).toBeNull();
  });

  it("is a 404 for a place outside the library", async () => {
    const { service } = setup();
    await expect(service.markVisited(OWNER, "place-a")).rejects.toMatchObject({ status: 404 });
  });
});

describe("PlacesService.getPlacePhotoUrls", () => {
  it("serves photos of a saved place", async () => {
    const { repo, service } = setup();
    await repo.tryInsertSavedPlace({ owner_user_id: OWNER, place_id: "place-a" });
    expect(await service.getPlacePhotoUrls(OWNER, "place-a", 2, 800)).toEqual({ urls: ["https://lh3/photos/1", "https://lh3/photos/2"] });
  });

  it("is a 404 for a place the caller has not saved, even one that exists", async () => {
    const { service } = setup();
    await expect(service.getPlacePhotoUrls(OWNER, "place-b", 2, 800)).rejects.toMatchObject({ status: 404 });
  });
});
