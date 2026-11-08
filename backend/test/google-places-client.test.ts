import { afterEach, describe, expect, it, vi } from "vitest";
import { matchPlaces } from "../src/modules/recognitions/place-text-search.js";
import { GooglePlacesClient, GooglePlacesSearchError } from "../src/services/google/google-places-client.js";
import type { ExtractedPlace } from "../src/types/schemas.js";

/** The body Google answers with once a key has been deleted or has expired. */
const expiredKey = JSON.stringify({
  error: { code: 400, message: "API key expired. Please renew the API key.", status: "INVALID_ARGUMENT" },
});

function googleAnswers(body: string, status: number): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
}

const client = new GooglePlacesClient("test-key");
const nearby = { center: { latitude: 39.9, longitude: 32.8 }, radiusMeters: 75, includedTypes: ["amusement_park"] };

const ankapark: ExtractedPlace = {
  name: "Ankapark",
  category: "attraction",
  location_hint: "Ankara, Türkiye",
  address: null,
  instagram_username: null,
  recommendations: [],
  confidence_score: 0.9,
  source: "video",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GooglePlacesClient searches", () => {
  it("throws Google's reason when a text search is refused", async () => {
    googleAnswers(expiredKey, 400);
    await expect(client.searchText("Ankapark, Ankara")).rejects.toThrow(
      "Google Places search failed (HTTP 400): API key expired. Please renew the API key.",
    );
  });

  it("throws when a nearby search is refused", async () => {
    googleAnswers(expiredKey, 400);
    await expect(client.searchNearby(nearby)).rejects.toBeInstanceOf(GooglePlacesSearchError);
  });

  it("still names the status when the failure has no JSON body", async () => {
    googleAnswers("upstream connect error", 503);
    await expect(client.searchText("Ankapark")).rejects.toMatchObject({ status: 503 });
  });

  it("answers an empty list when Google simply found nothing", async () => {
    googleAnswers("{}", 200);
    await expect(client.searchText("no such place at all")).resolves.toEqual([]);
    await expect(client.searchNearby(nearby)).resolves.toEqual([]);
  });

  it("fails the match instead of reporting the venue as not found", async () => {
    googleAnswers(expiredKey, 400);
    await expect(matchPlaces([ankapark], client)).rejects.toBeInstanceOf(GooglePlacesSearchError);
  });
});
