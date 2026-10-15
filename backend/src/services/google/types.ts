/** Google Places API (New) – full place response subset */
export interface GooglePlaceV1 {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  addressComponents?: Array<{ longText: string; types?: string[] }>;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  regularOpeningHours?: unknown;
}

/** Result from the Places Text Search API (subset of fields we request). */
export interface TextSearchResult {
  id: string;
  displayName?: { text: string; languageCode?: string };
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  photos?: Array<{ name: string }>;
  /** Place types (https://developers.google.com/maps/documentation/places/web-service/place-types); a street is `route`. */
  types?: string[];
  primaryType?: string;
}
