import type { Logger } from "../../lib/logger.js";
import type { GooglePlaceV1, TextSearchResult } from "./types.js";

const PLACE_DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "addressComponents",
  "location",
  "primaryType",
  "types",
  "rating",
  "userRatingCount",
  "priceLevel",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "businessStatus",
  "regularOpeningHours",
  "utcOffsetMinutes",
].join(",");

const TEXT_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.photos",
  "places.types",
  "places.primaryType",
].join(",");

export interface NearbySearchParams {
  center: { latitude: number; longitude: number };
  radiusMeters: number;
  /** Place types (Table A) to include; a place matches when it carries any of them. */
  includedTypes: string[];
  maxResultCount?: number;
}

/**
 * Google refused or failed a search. It is thrown rather than answered with an empty list
 * because "no such place" and "the key is dead" must not look alike: a recognition that took
 * one for the other reported success, found nothing, and cached that for the post.
 */
export class GooglePlacesSearchError extends Error {
  constructor(
    readonly status: number,
    reason: string,
  ) {
    super(`Google Places search failed (HTTP ${status}): ${reason}`);
    this.name = "GooglePlacesSearchError";
  }
}

async function searchErrorFrom(response: Response): Promise<GooglePlacesSearchError> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return new GooglePlacesSearchError(response.status, body?.error?.message ?? response.statusText);
}

export interface IGooglePlacesClient {
  /** Text Search candidates in Google's rank order; empty when nothing matched. Throws `GooglePlacesSearchError` when the call fails. */
  searchText(query: string, maxResultCount?: number): Promise<TextSearchResult[]>;
  /** Places around a point, nearest first; empty when nothing matched. Throws `GooglePlacesSearchError` when the call fails. */
  searchNearby(params: NearbySearchParams): Promise<TextSearchResult[]>;
  getPlaceDetails(googlePlaceId: string): Promise<GooglePlaceV1 | null>;
  getPlacePhotos(googlePlaceId: string): Promise<string[]>;
}

export class GooglePlacesClient implements IGooglePlacesClient {
  constructor(
    private readonly apiKey: string,
    private readonly log?: Logger,
  ) {}

  async searchText(query: string, maxResultCount = 1): Promise<TextSearchResult[]> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
    });

    if (!response.ok) throw await searchErrorFrom(response);

    const data = (await response.json()) as { places?: TextSearchResult[] };
    return data.places ?? [];
  }

  async searchNearby(params: NearbySearchParams): Promise<TextSearchResult[]> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        locationRestriction: { circle: { center: params.center, radius: params.radiusMeters } },
        includedTypes: params.includedTypes,
        maxResultCount: params.maxResultCount ?? 10,
        rankPreference: "DISTANCE",
      }),
    });

    if (!response.ok) throw await searchErrorFrom(response);

    const data = (await response.json()) as { places?: TextSearchResult[] };
    return data.places ?? [];
  }

  async getPlaceDetails(googlePlaceId: string): Promise<GooglePlaceV1 | null> {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": PLACE_DETAILS_FIELD_MASK,
      },
    });

    if (!response.ok) {
      this.log?.warn({ googlePlaceId, status: response.status }, "place details failed");
      return null;
    }

    return (await response.json()) as GooglePlaceV1;
  }

  async getPlacePhotos(googlePlaceId: string): Promise<string[]> {
    const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(googlePlaceId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": "photos",
      },
    });

    if (!response.ok) {
      this.log?.debug({ googlePlaceId, status: response.status }, "place photos failed");
      return [];
    }

    const data = (await response.json()) as { photos?: Array<{ name: string }> };
    return (data.photos ?? []).map((p) => p.name).filter(Boolean);
  }
}
