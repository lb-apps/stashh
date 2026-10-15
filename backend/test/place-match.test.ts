import { describe, expect, it } from "vitest";
import type { IGooglePlacesClient, NearbySearchParams } from "../src/services/google/google-places-client.js";
import type { TextSearchResult } from "../src/services/google/types.js";
import { matchPlaces } from "../src/modules/recognitions/place-text-search.js";
import type { ExtractedPlace, VenueCategory } from "../src/types/schemas.js";

/** Text answers by query; nearby answers by "lat,lng" of the centre asked for. */
function fakeClient(
  answers: Record<string, TextSearchResult[]>,
  nearby: Record<string, TextSearchResult[]> = {},
): IGooglePlacesClient & { queries: string[]; nearbyCalls: NearbySearchParams[] } {
  const queries: string[] = [];
  const nearbyCalls: NearbySearchParams[] = [];
  return {
    queries,
    nearbyCalls,
    async searchText(query) {
      queries.push(query);
      return answers[query] ?? [];
    },
    async searchNearby(params) {
      nearbyCalls.push(params);
      return nearby[`${params.center.latitude},${params.center.longitude}`] ?? [];
    },
    async getPlaceDetails() {
      return null;
    },
    async getPlacePhotos() {
      return [];
    },
  };
}

const extracted = (name: string, location_hint: string | null = null, category: VenueCategory = "restaurant", address: string | null = null): ExtractedPlace => ({
  name,
  category,
  location_hint,
  address,
  instagram_username: null,
  recommendations: [],
  confidence_score: 0.9,
  source: "video",
});

const street: TextSearchResult = {
  id: "street",
  displayName: { text: "Sofyalı Sk. No:9" },
  shortFormattedAddress: "Asmalı Mescit, Sofyalı Sk. No:9, Beyoğlu",
  types: ["subpremise", "street_address"],
};
const meyhane: TextSearchResult = {
  id: "sofyali-meyhane",
  displayName: { text: "Sofyalı Meyhane" },
  shortFormattedAddress: "Asmalı Mescit, Sofyalı Sk. No:7, Beyoğlu",
  location: { latitude: 41.03, longitude: 28.97 },
  rating: 4.4,
  photos: [{ name: "places/sofyali-meyhane/photos/1" }],
  types: ["turkish_restaurant", "bar", "restaurant", "food", "point_of_interest", "establishment"],
  primaryType: "bar",
};

describe("matchPlaces", () => {
  it("skips a street listed first and takes the business behind it", async () => {
    const client = fakeClient({ "Sofyalı 9, Beyoğlu, İstanbul": [street, meyhane] });
    const matches = await matchPlaces([extracted("Sofyalı 9", "Beyoğlu, İstanbul")], client);
    expect(matches.get("Sofyalı 9")).toEqual({
      google_place_id: "sofyali-meyhane",
      name: "Sofyalı Meyhane",
      address: "Asmalı Mescit, Sofyalı Sk. No:7, Beyoğlu",
      location: { latitude: 41.03, longitude: 28.97 },
      rating: 4.4,
      first_photo_name: "places/sofyali-meyhane/photos/1",
    });
    expect(client.queries).toEqual(["Sofyalı 9, Beyoğlu, İstanbul"]);
  });

  it("retries with the category word when the name alone reads as an address", async () => {
    const client = fakeClient({
      "Sofyalı 9, Beyoğlu, İstanbul": [street],
      "Sofyalı 9 restaurant, Beyoğlu, İstanbul": [meyhane],
    });
    const matches = await matchPlaces([extracted("Sofyalı 9", "Beyoğlu, İstanbul")], client);
    expect(matches.get("Sofyalı 9")?.google_place_id).toBe("sofyali-meyhane");
    expect(client.queries).toEqual(["Sofyalı 9, Beyoğlu, İstanbul", "Sofyalı 9 restaurant, Beyoğlu, İstanbul"]);
  });

  it("does not retry for a venue of unknown kind", async () => {
    const client = fakeClient({ Nowhere: [] });
    const matches = await matchPlaces([extracted("Nowhere", null, "other")], client);
    expect(matches.get("Nowhere")).toBeNull();
    expect(client.queries).toEqual(["Nowhere"]);
  });

  it("leaves a venue unmatched when only its landlord or neighbour comes back", async () => {
    const client = fakeClient({
      "Touché, Zorlu PSM, İstanbul": [
        { id: "psm", displayName: { text: "Zorlu Performing Arts Center" }, types: ["performing_arts_theater", "point_of_interest"] },
      ],
      "Touché bar, Zorlu PSM, İstanbul": [],
      "Ritmo, İstanbul": [{ id: "arkestra", displayName: { text: "Arkestra" }, types: ["fine_dining_restaurant", "restaurant"] }],
      "Ritmo restaurant, İstanbul": [{ id: "arkestra", displayName: { text: "Arkestra" }, types: ["fine_dining_restaurant", "restaurant"] }],
    });
    const matches = await matchPlaces([extracted("Touché", "Zorlu PSM, İstanbul", "bar"), extracted("Ritmo", "İstanbul")], client);
    expect(matches.get("Touché")).toBeNull();
    expect(matches.get("Ritmo")).toBeNull();
  });

  it("never pins a venue to a street or a neighbourhood, whatever the name says", async () => {
    const client = fakeClient({
      "Tarihi Yeldeğirmeni": [
        { id: "route", displayName: { text: "Tarihi Yeldeğirmeni Sokak" }, types: ["route"] },
        { id: "hood", displayName: { text: "Yeldeğirmeni" }, types: ["neighborhood", "political"] },
      ],
      "Tarihi Yeldeğirmeni restaurant": [],
    });
    const matches = await matchPlaces([extracted("Tarihi Yeldeğirmeni")], client);
    expect(matches.get("Tarihi Yeldeğirmeni")).toBeNull();
  });

  it("rejects a business of a plainly different kind for a food or drink post", async () => {
    const client = fakeClient({
      "Ritmo, İstanbul": [
        { id: "shop", displayName: { text: "Ritmo Elektronik San. ve Tic. Ltd. Şti." }, types: ["electronics_store", "store", "point_of_interest", "establishment"] },
      ],
      "Ritmo restaurant, İstanbul": [],
    });
    const matches = await matchPlaces([extracted("Ritmo", "İstanbul")], client);
    expect(matches.get("Ritmo")).toBeNull();
  });

  const pub: TextSearchResult = {
    id: "pub",
    displayName: { text: "Sofyalı Pub" },
    shortFormattedAddress: "Asmalı Mescit, Sofyalı Sk. No:9A, Beyoğlu",
    types: ["pub", "bar", "point_of_interest", "establishment"],
  };
  const no7: TextSearchResult = {
    id: "no7",
    displayName: { text: "Sofyalı Sk. No:7" },
    shortFormattedAddress: "Asmalı Mescit, Sofyalı Sk. No:7, Beyoğlu",
    location: { latitude: 41.02961, longitude: 28.97458 },
    types: ["subpremise", "street_address"],
  };
  const saraphane: TextSearchResult = {
    id: "saraphane",
    displayName: { text: "Beyoğlu Şaraphanesi" },
    shortFormattedAddress: "Asmalı Mescit, Sofyalı Sk. No:7, Beyoğlu",
    types: ["restaurant", "wine_bar", "turkish_restaurant"],
  };

  it("looks at the address the post wrote first and picks the listing at that door", async () => {
    const client = fakeClient(
      {
        "Sofyalı Sokak No: 7, Asmalımescit, Beyoğlu": [no7],
        "Sofyalı, Asmalımescit, Beyoğlu": [street],
        "Sofyalı bar, Asmalımescit, Beyoğlu": [pub],
      },
      { "41.02961,28.97458": [saraphane, meyhane, pub] },
    );
    const post = extracted("Sofyalı", "Asmalımescit, Beyoğlu", "bar", "Sofyalı Sokak No: 7, Asmalımescit, Beyoğlu");
    const matches = await matchPlaces([post], client);
    expect(matches.get("Sofyalı")?.google_place_id).toBe("sofyali-meyhane");
    expect(client.queries).toEqual(["Sofyalı Sokak No: 7, Asmalımescit, Beyoğlu"]);
    expect(client.nearbyCalls[0]).toMatchObject({ radiusMeters: 75, includedTypes: expect.arrayContaining(["bar", "restaurant"]) });
  });

  it("falls back to the text queries when nothing at the address carries the name", async () => {
    const forno: TextSearchResult = { id: "forno", displayName: { text: "Forno Di Roma" }, types: ["pizza_restaurant", "restaurant"] };
    const client = fakeClient(
      {
        "Moda Cd. Emel Apt No:4, Kadıköy": [{ id: "dem", displayName: { text: "Dem Moda" }, location: { latitude: 40.98381, longitude: 29.02659 }, types: ["cafe"] }],
        "Forno di Roma, Kadıköy, İstanbul": [forno],
      },
      { "40.98381,29.02659": [{ id: "dem", displayName: { text: "Dem Moda" }, types: ["cafe"] }, { id: "gg", displayName: { text: "GG Pizza Moda" }, types: ["pizza_restaurant"] }] },
    );
    const post = extracted("Forno di Roma", "Kadıköy, İstanbul", "restaurant", "Moda Cd. Emel Apt No:4, Kadıköy");
    const matches = await matchPlaces([post], client);
    expect(matches.get("Forno di Roma")?.google_place_id).toBe("forno");
  });

  it("tells two listings on one street apart by the address the post wrote", async () => {
    const client = fakeClient({
      "Sofyalı Sokak No: 7, Asmalımescit, Beyoğlu": [],
      "Sofyalı, Asmalımescit, Beyoğlu": [street, pub, meyhane],
    });
    const post = extracted("Sofyalı", "Asmalımescit, Beyoğlu", "bar", "Sofyalı Sokak No: 7, Asmalımescit, Beyoğlu");
    const matches = await matchPlaces([post], client);
    expect(matches.get("Sofyalı")?.google_place_id).toBe("sofyali-meyhane");
  });

  it("prefers the candidate whose kind agrees with the post", async () => {
    const client = fakeClient({
      "Bravo, Beyoğlu": [
        { id: "pizza", displayName: { text: "Bravo" }, types: ["pizza_restaurant", "restaurant", "food"] },
        { id: "roastery", displayName: { text: "Bravo Coffee Roastery" }, types: ["coffee_shop", "cafe", "food_store", "store"] },
      ],
    });
    const matches = await matchPlaces([extracted("Bravo", "Beyoğlu", "cafe")], client);
    expect(matches.get("Bravo")?.google_place_id).toBe("roastery");
  });

  it("accepts a listing that spells the name its own way, in any script", async () => {
    const client = fakeClient({
      "MAC&CHEESE, Kadıköy": [{ id: "mac", displayName: { text: "Mac and Cheese Istanbul" }, types: ["restaurant"] }],
      "ΡΑΝΤΙΚΑΛ kitchen, Athens": [{ id: "rad", displayName: { text: "Ραντικαλ Kitchen" }, types: ["greek_restaurant", "restaurant"] }],
    });
    const matches = await matchPlaces([extracted("MAC&CHEESE", "Kadıköy"), extracted("ΡΑΝΤΙΚΑΛ kitchen", "Athens")], client);
    expect(matches.get("MAC&CHEESE")?.google_place_id).toBe("mac");
    expect(matches.get("ΡΑΝΤΙΚΑΛ kitchen")?.google_place_id).toBe("rad");
  });

  it("trusts a candidate without type data, as older responses have none", async () => {
    const client = fakeClient({ "Forno di Roma": [{ id: "forno", displayName: { text: "Forno Di Roma" } }] });
    const matches = await matchPlaces([extracted("Forno di Roma")], client);
    expect(matches.get("Forno di Roma")?.google_place_id).toBe("forno");
  });

  it("returns null when the search finds nothing", async () => {
    const matches = await matchPlaces([extracted("Nowhere")], fakeClient({}));
    expect(matches.get("Nowhere")).toBeNull();
  });
});
