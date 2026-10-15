import type { Logger } from "../../lib/logger.js";
import type { IGooglePlacesClient } from "../../services/google/google-places-client.js";
import type { TextSearchResult } from "../../services/google/types.js";
import type { ExtractedPlace, MatchedPlace, VenueCategory } from "../../types/schemas.js";
import { nameSimilarity } from "./name-similarity.js";

/**
 * Pins an extracted venue to one Google place, or to none.
 *
 * Text Search answers any query with something: asked for "Sofyalı 9" it returns the
 * street address, asked for a Yeldeğirmeni café it returned the street. So the first
 * hit is not taken on trust. A few candidates are fetched; anything that is a street,
 * an address or an area rather than a business is dropped, a business of a plainly
 * different kind (an electronics store for a restaurant) is dropped, and the rest must
 * resemble the name the post used, with a nudge toward the kind of place the post
 * describes. When the name alone reads as an address, the search is repeated with the
 * category word ("Sofyalı 9 restaurant"), which is how a person would type it. And when
 * the post states a street address, that is looked at first: the address is geocoded
 * and the businesses within a few doors of it are checked by name, which is how "📍
 * Sofyalı Sokak No: 7" tells Sofyalı Meyhane at No:7 from Sofyalı Pub at No:9A. A venue
 * nothing resembles stays unmatched: a card for the wrong place is worse than no card.
 */

const CANDIDATE_COUNT = 3;
const MINIMUM_NAME_SIMILARITY = 0.6;
/** How far from the post's address a listing may sit; a street number, not a block. */
const ADDRESS_RADIUS_METERS = 75;
const NEARBY_COUNT = 10;
/** Added to a candidate whose Google types agree with the post's category. */
const CATEGORY_AGREEMENT_BONUS = 0.15;
/** Scales how alike the listing's address is to the one the post wrote; tells No:7 from No:9A on one street. */
const ADDRESS_AGREEMENT_WEIGHT = 0.1;

/** Place types that name where something is, never what it is. */
const PLACE_TYPES_THAT_ARE_NOT_BUSINESSES = new Set([
  "route",
  "street_address",
  "street_number",
  "intersection",
  "premise",
  "subpremise",
  "plus_code",
  "postal_code",
  "postal_code_prefix",
  "postal_code_suffix",
  "postal_town",
  "post_box",
  "floor",
  "room",
  "locality",
  "sublocality",
  "sublocality_level_1",
  "sublocality_level_2",
  "sublocality_level_3",
  "sublocality_level_4",
  "sublocality_level_5",
  "neighborhood",
  "colloquial_area",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "administrative_area_level_4",
  "administrative_area_level_5",
  "administrative_area_level_6",
  "administrative_area_level_7",
  "country",
  "continent",
  "archipelago",
  "political",
  "geocode",
]);

/** Google place types that belong to each category; a type ending in `_restaurant` counts as restaurant. */
const CATEGORY_TYPES: Record<Exclude<VenueCategory, "other">, string[]> = {
  restaurant: ["restaurant", "food", "meal_takeaway", "meal_delivery", "diner", "food_court", "cafeteria", "steak_house", "sushi_restaurant", "pizza_restaurant", "hamburger_restaurant", "sandwich_shop", "bar_and_grill", "brunch_restaurant", "breakfast_restaurant"],
  cafe: ["cafe", "coffee_shop", "tea_house", "cat_cafe", "dog_cafe", "brunch_restaurant", "breakfast_restaurant", "bakery", "dessert_shop"],
  bar: ["bar", "pub", "wine_bar", "night_club", "cocktail_bar", "live_music_venue", "karaoke", "comedy_club", "bar_and_grill"],
  bakery: ["bakery", "bagel_shop", "donut_shop", "confectionery", "dessert_shop", "cafe", "coffee_shop"],
  dessert: ["dessert_shop", "dessert_restaurant", "ice_cream_shop", "confectionery", "candy_store", "chocolate_shop", "bakery", "juice_shop", "acai_shop", "cafe"],
  hotel: ["lodging", "hotel", "hostel", "motel", "resort_hotel", "bed_and_breakfast", "guest_house", "inn", "extended_stay_hotel", "campground"],
  attraction: ["tourist_attraction", "museum", "art_gallery", "park", "historical_landmark", "historical_place", "monument", "garden", "beach", "zoo", "aquarium", "amusement_park", "observation_deck", "cultural_landmark", "national_park", "marina", "plaza", "church", "mosque", "synagogue", "hindu_temple", "place_of_worship", "library", "performing_arts_theater", "concert_hall", "stadium", "water_park", "botanical_garden", "wildlife_park", "ski_resort", "spa", "public_bath", "hiking_area", "scenic_point"],
  shop: ["store", "shopping_mall", "market", "grocery_store", "supermarket", "clothing_store", "book_store", "florist", "gift_shop", "jewelry_store", "shoe_store", "furniture_store", "home_goods_store", "convenience_store", "department_store", "electronics_store", "liquor_store", "pet_store", "sporting_goods_store", "wholesaler", "food_store", "butcher_shop", "cheese_shop", "wine_store"],
};

/** Hospitality-wide family: a candidate inside it is never a wrong kind for a food or drink post. */
const HOSPITALITY_TYPES = new Set([
  ...CATEGORY_TYPES.restaurant,
  ...CATEGORY_TYPES.cafe,
  ...CATEGORY_TYPES.bar,
  ...CATEGORY_TYPES.bakery,
  ...CATEGORY_TYPES.dessert,
  "point_of_interest",
  "establishment",
]);

/** Table A types Nearby Search is asked for around a post's address, by what the post says the place is. */
const NEARBY_TYPES: Record<VenueCategory, string[]> = {
  restaurant: ["restaurant", "bar", "cafe", "coffee_shop", "meal_takeaway", "bakery"],
  cafe: ["cafe", "coffee_shop", "bakery", "restaurant", "dessert_shop", "tea_house"],
  bar: ["bar", "night_club", "pub", "wine_bar", "restaurant", "cafe"],
  bakery: ["bakery", "cafe", "coffee_shop", "dessert_shop", "restaurant"],
  dessert: ["dessert_shop", "ice_cream_shop", "bakery", "cafe", "coffee_shop", "confectionery"],
  hotel: ["lodging", "hotel", "hostel", "restaurant", "bar"],
  attraction: ["tourist_attraction", "museum", "park", "art_gallery", "historical_landmark", "restaurant", "cafe"],
  shop: ["store", "shopping_mall", "market", "cafe", "restaurant"],
  other: ["restaurant", "bar", "cafe", "coffee_shop", "bakery", "dessert_shop", "lodging", "tourist_attraction", "store"],
};

/** Google's English category word for the retry query; multilingual search ranks on it. */
const CATEGORY_WORD: Record<Exclude<VenueCategory, "other">, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  bar: "bar",
  bakery: "bakery",
  dessert: "dessert",
  hotel: "hotel",
  attraction: "attraction",
  shop: "shop",
};

function isBusiness(candidate: TextSearchResult): boolean {
  if (candidate.primaryType && PLACE_TYPES_THAT_ARE_NOT_BUSINESSES.has(candidate.primaryType)) return false;
  return !(candidate.types ?? []).some((type) => PLACE_TYPES_THAT_ARE_NOT_BUSINESSES.has(type));
}

function typeMatchesCategory(type: string, category: Exclude<VenueCategory, "other">): boolean {
  if (CATEGORY_TYPES[category].includes(type)) return true;
  return category === "restaurant" && type.endsWith("_restaurant");
}

function agreesWithCategory(candidate: TextSearchResult, category: VenueCategory): boolean {
  if (category === "other") return false;
  const types = [...(candidate.types ?? []), ...(candidate.primaryType ? [candidate.primaryType] : [])];
  return types.some((type) => typeMatchesCategory(type, category));
}

/**
 * A food or drink post never means a shop or an office. Candidates whose specific types
 * sit entirely outside hospitality are the wrong kind; a listing with only the generic
 * `point_of_interest` / `establishment` types is left to the name check.
 */
function isWrongKind(candidate: TextSearchResult, category: VenueCategory): boolean {
  const hospitality = category === "restaurant" || category === "cafe" || category === "bar" || category === "bakery" || category === "dessert";
  if (!hospitality) return false;
  const types = candidate.types ?? [];
  if (types.length === 0) return false;
  const specific = types.filter((type) => type !== "point_of_interest" && type !== "establishment");
  if (specific.length === 0) return false;
  return !specific.some((type) => HOSPITALITY_TYPES.has(type) || type.endsWith("_restaurant"));
}

function toMatchedPlace(extracted: ExtractedPlace, place: TextSearchResult): MatchedPlace {
  return {
    google_place_id: place.id,
    name: place.displayName?.text ?? extracted.name,
    address: place.shortFormattedAddress ?? "",
    location:
      place.location?.latitude != null && place.location?.longitude != null
        ? { latitude: place.location.latitude, longitude: place.location.longitude }
        : null,
    rating: place.rating ?? null,
    first_photo_name: place.photos?.[0]?.name ?? null,
  };
}

interface Considered {
  name: string;
  score: number;
  rejected: "not a business" | "wrong kind" | null;
}

interface Attempt {
  query: string;
  candidates: Considered[];
}

function pickBest(
  extracted: ExtractedPlace,
  candidates: TextSearchResult[],
): { best: TextSearchResult | null; score: number; considered: Considered[] } {
  let best: TextSearchResult | null = null;
  let bestScore = 0;
  const considered: Considered[] = [];
  for (const candidate of candidates) {
    const name = candidate.displayName?.text ?? "";
    const rejected = !isBusiness(candidate) ? "not a business" : isWrongKind(candidate, extracted.category) ? "wrong kind" : null;
    let score = 0;
    if (!rejected) {
      score = nameSimilarity(extracted.name, name);
      if (score > 0 && agreesWithCategory(candidate, extracted.category)) score += CATEGORY_AGREEMENT_BONUS;
      if (score > 0 && extracted.address && candidate.shortFormattedAddress) {
        score += ADDRESS_AGREEMENT_WEIGHT * nameSimilarity(extracted.address, candidate.shortFormattedAddress);
      }
    }
    considered.push({ name, score: Number(score.toFixed(2)), rejected });
    if (!rejected && score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return { best: bestScore >= MINIMUM_NAME_SIMILARITY ? best : null, score: bestScore, considered };
}

/** The text queries to try, in order: the name as the post wrote it, then the name with its category. */
function queriesFor(extracted: ExtractedPlace): string[] {
  const where = extracted.location_hint ? `, ${extracted.location_hint}` : "";
  const queries = [`${extracted.name}${where}`];
  if (extracted.category !== "other") queries.push(`${extracted.name} ${CATEGORY_WORD[extracted.category]}${where}`);
  return queries;
}

/**
 * The businesses within a few doors of the address the post wrote. The address is
 * geocoded through Text Search, whose first answer is the point even when it is a
 * street address rather than a business; a point nothing can be made of yields no
 * candidates and the text queries take over.
 */
async function candidatesAroundAddress(extracted: ExtractedPlace, client: IGooglePlacesClient): Promise<{ query: string; candidates: TextSearchResult[] }> {
  const address = extracted.address!;
  const query = `near ${address}`;
  const [point] = await client.searchText(address, 1);
  const center = point?.location;
  if (center?.latitude == null || center?.longitude == null) return { query, candidates: [] };
  const candidates = await client.searchNearby({
    center: { latitude: center.latitude, longitude: center.longitude },
    radiusMeters: ADDRESS_RADIUS_METERS,
    includedTypes: NEARBY_TYPES[extracted.category],
    maxResultCount: NEARBY_COUNT,
  });
  return { query, candidates };
}

async function matchPlace(
  extracted: ExtractedPlace,
  client: IGooglePlacesClient,
  log?: Logger,
): Promise<MatchedPlace | null> {
  const attempts: Attempt[] = [];
  const consider = (query: string, candidates: TextSearchResult[]): TextSearchResult | null => {
    const { best, considered } = pickBest(extracted, candidates);
    attempts.push({ query, candidates: considered });
    return best;
  };
  const accept = (best: TextSearchResult): MatchedPlace => {
    log?.info({ venue: extracted.name, category: extracted.category, attempts, picked: best.displayName?.text }, "place matched");
    return toMatchedPlace(extracted, best);
  };

  if (extracted.address) {
    const { query, candidates } = await candidatesAroundAddress(extracted, client);
    const best = consider(query, candidates);
    if (best) return accept(best);
  }
  for (const query of queriesFor(extracted)) {
    const best = consider(query, await client.searchText(query, CANDIDATE_COUNT));
    if (best) return accept(best);
  }
  log?.info({ venue: extracted.name, category: extracted.category, attempts, picked: null }, "place unmatched");
  return null;
}

export async function matchPlaces(
  places: ExtractedPlace[],
  client: IGooglePlacesClient,
  log?: Logger,
): Promise<Map<string, MatchedPlace | null>> {
  const entries = await Promise.all(
    places.map(async (place) => {
      const matched = await matchPlace(place, client, log);
      return [place.name, matched] as const;
    }),
  );

  return new Map(entries);
}
