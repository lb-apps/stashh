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
].join(",");

const TEXT_SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.shortFormattedAddress",
  "places.location",
  "places.rating",
  "places.photos",
].join(",");

export interface IGooglePlacesClient {
  searchText(query: string, maxResultCount?: number): Promise<TextSearchResult | null>;
  getPlaceDetails(googlePlaceId: string): Promise<GooglePlaceV1 | null>;
  getPlacePhotos(googlePlaceId: string): Promise<string[]>;
}

export class GooglePlacesClient implements IGooglePlacesClient {
  constructor(
    private readonly apiKey: string,
    private readonly log?: Logger,
  ) {}

  async searchText(query: string, maxResultCount = 1): Promise<TextSearchResult | null> {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
    });

    if (!response.ok) {
      this.log?.warn({ query, status: response.status }, "text search failed");
      return null;
    }

    const data = (await response.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string; languageCode?: string };
        shortFormattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        photos?: Array<{ name: string }>;
      }>;
    };

    return data.places?.[0] ?? null;
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
