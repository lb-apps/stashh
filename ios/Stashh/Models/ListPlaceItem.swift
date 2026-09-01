//
//  ListPlaceItem.swift
//  Stashh
//
//  Maps to the `ListPlaceItem` backend DTO from GET /lists/{listId}/places.
//  The backend returns a nested shape: { list_place_id, place_id, created_at, place:{…} }

import Foundation

// MARK: - ListPlaceItem

struct ListPlaceItem: Codable, Identifiable, Sendable, Hashable {
    /// The junction-table row ID (list_place.id). Use this for removePlace calls.
    let listPlaceId: String
    /// The saved-place UUID.
    let placeId: String
    let createdAt: String
    let place: ListPlaceItemPlace

    /// Conforms to Identifiable using the junction row ID.
    var id: String { listPlaceId }
}

// MARK: - ListPlaceItemPlace

/// The nested place summary inside ListPlaceItem.
struct ListPlaceItemPlace: Codable, Sendable, Hashable {
    let id: String
    let name: String
    let thumbnailUrl: String?
    let address: String?
}

// MARK: - AddListPlaceResult

/// Response data from POST /lists/{listId}/places.
struct AddListPlaceResult: Codable, Sendable {
    let listPlaceId: String
    let listId: String
    let placeId: String
    let createdAt: String
}

// MARK: - RemoveListPlaceResult

/// Response data from DELETE /lists/{listId}/places/{listPlaceId}.
struct RemoveListPlaceResult: Codable, Sendable {
    let listPlaceId: String
    let deleted: Bool
}

// MARK: - DeleteListResult

/// Response data from DELETE /lists/{listId}.
struct DeleteListResult: Codable, Sendable {
    let id: String
    let deleted: Bool
}
