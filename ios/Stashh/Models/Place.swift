//
//  Place.swift
//  Stashh
//

import Foundation

// MARK: - Place

/// A place saved to the user's library.
/// Maps to the `SavedPlace` backend DTO.
struct Place: Codable, Identifiable, Sendable, Hashable {
    let id: String
    let googlePlaceId: String?
    let name: String
    let address: String?
    let shortFormattedAddress: String?
    let city: String?
    let district: String?
    let country: String?
    let location: Coordinate?
    let category: String?
    let rating: Double?
    let ratingCount: Int?
    let priceLevel: Int?
    let thumbnailUrl: String?
    let websiteUrl: String?
    let phoneNumber: String?
    let googleMapsUri: String?
    let businessStatus: String?
    let instagramUsername: String?
    /// Google place-type strings (e.g. "coffee_shop", "cafe"). Surfaced as chips.
    let types: [String]?
    /// Weekly opening periods. A bare array of Google `periods` (the backend
    /// flattens `{periods:[…]}` → `[…]` and strips `openNow` — open-now is
    /// derived client-side via `OpeningHours`). `nil` when hours are unknown.
    let openingHours: [OpeningPeriod]?
    let recommendations: [VenueRecommendation]
  let notes: String?
  let savedAt: String
  /// Distance in metres from the queried coordinate. Only present in nearby-places responses.
  let distanceM: Double?
}

// MARK: - OpeningPeriod

/// One Google opening period. A `nil` `close` means the venue opens at `open`
/// and stays open 24h (Google's convention for round-the-clock venues).
struct OpeningPeriod: Codable, Sendable, Hashable {
    let open: TimePoint
    let close: TimePoint?
}

// MARK: - TimePoint

/// A weekday + wall-clock time within an `OpeningPeriod`. `day` is 0=Sunday …
/// 6=Saturday, matching Google's `periods[].open.day`.
struct TimePoint: Codable, Sendable, Hashable {
    let day: Int
    let hour: Int
    let minute: Int
}

// MARK: - Coordinate

struct Coordinate: Codable, Sendable, Hashable {
    let latitude: Double
    let longitude: Double
}

// MARK: - VenueRecommendation

struct VenueRecommendation: Codable, Sendable, Hashable {
    let summary: String
    let kind: RecommendationKind
}

// MARK: - RecommendationKind

enum RecommendationKind: String, Codable, Sendable, CaseIterable {
    case dish
    case drink
    case cocktail
    case dessert
    case activity
    case ordering
    case timing
    case general
}

// MARK: - SavedPlaceListData

/// Wrapper returned by GET /places: { items, total_count }
struct SavedPlaceListData: Decodable, Sendable {
    let items: [Place]
    let totalCount: Int
}

// MARK: - AddPlacesResult

/// Top-level data wrapper from POST /places: { results: [...] }
struct AddPlacesResult: Decodable, Sendable {
    let results: [AddPlaceResultEntry]
}

/// Single entry in the POST /places result array.
struct AddPlaceResultEntry: Codable, Sendable {
    /// The user's saved-place UUID — use this for all subsequent operations.
    let placeId: String
    /// The Google Place ID that was looked up.
    let googlePlaceId: String
    /// true = newly saved; false = was already in the library.
    let created: Bool
}

// MARK: - PlacePhotosData

/// Response from GET /places/:id/photos
struct PlacePhotosData: Codable, Sendable {
    let urls: [String]
}
