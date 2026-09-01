//
//  PlacesRepository.swift
//  Stashh
//

import Foundation

// MARK: - PlacesRepositoryProtocol

protocol PlacesRepositoryProtocol: Sendable {
    func list(limit: Int, cursor: String?, sort: String?, district: String?, category: String?) async throws(APIError) -> PaginatedResponse<[Place]>
    func get(id: String) async throws(APIError) -> Place
    func add(_ request: AddPlacesRequest) async throws(APIError) -> [AddPlaceResultEntry]
    func update(id: String, notes: String?) async throws(APIError) -> Place
    func delete(id: String) async throws(APIError)
    func photos(placeId: String, limit: Int, maxWidth: Int) async throws(APIError) -> [String]
    func fetchNearbyPlaces(latitude: Double, longitude: Double, radiusM: Int, limit: Int, cursor: String?, category: String?) async throws(APIError) -> PaginatedResponse<[Place]>
}

// MARK: - PlacesRepository

struct PlacesRepository: PlacesRepositoryProtocol, Sendable {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func list(
        limit: Int = 20,
        cursor: String? = nil,
        sort: String? = nil,
        district: String? = nil,
        category: String? = nil
    ) async throws(APIError) -> PaginatedResponse<[Place]> {
        // Backend returns { items: [...], total_count: N } wrapped in the success envelope.
        let paged = try await client.requestPaginated(
            .places(limit: limit, cursor: cursor, sort: sort, district: district, category: category),
            as: SavedPlaceListData.self
        )
        return PaginatedResponse(data: paged.data.items, pagination: paged.pagination)
    }

    func get(id: String) async throws(APIError) -> Place {
        try await client.request(.place(id: id), as: Place.self)
    }

    func add(_ request: AddPlacesRequest) async throws(APIError) -> [AddPlaceResultEntry] {
        // Backend returns { results: [...] }
        let wrapper = try await client.request(.addPlaces(body: request), as: AddPlacesResult.self)
        return wrapper.results
    }

    func update(id: String, notes: String?) async throws(APIError) -> Place {
        try await client.request(.updatePlace(id: id, body: UpdatePlaceRequest(notes: notes)), as: Place.self)
    }

    func delete(id: String) async throws(APIError) {
        try await client.requestVoid(.deletePlace(id: id))
    }

    func photos(placeId: String, limit: Int = 10, maxWidth: Int = 800) async throws(APIError) -> [String] {
        let data = try await client.request(.placePhotos(id: placeId, limit: limit, maxWidth: maxWidth), as: PlacePhotosData.self)
        return data.urls
    }

    func fetchNearbyPlaces(
        latitude: Double,
        longitude: Double,
        radiusM: Int = 1000,
        limit: Int = 20,
        cursor: String? = nil,
        category: String? = nil
    ) async throws(APIError) -> PaginatedResponse<[Place]> {
        let paged = try await client.requestPaginated(
            .nearbyPlaces(latitude: latitude, longitude: longitude, radiusM: radiusM, limit: limit, cursor: cursor, category: category),
            as: SavedPlaceListData.self
        )
        return PaginatedResponse(data: paged.data.items, pagination: paged.pagination)
    }
}
