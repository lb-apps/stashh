//
//  ListsRepository.swift
//  Stashh
//

import Foundation

// MARK: - ListsRepositoryProtocol

protocol ListsRepositoryProtocol: Sendable {
    func list() async throws(APIError) -> [PlaceList]
    func get(id: String) async throws(APIError) -> PlaceList
    func create(body: CreateListRequest) async throws(APIError) -> PlaceList
    func update(id: String, body: PatchListRequest) async throws(APIError) -> PlaceList
    func delete(id: String) async throws(APIError)
    func places(listId: String, limit: Int, cursor: String?) async throws(APIError) -> PaginatedResponse<[ListPlaceItem]>
    func addPlace(listId: String, placeId: String) async throws(APIError) -> AddListPlaceResult
    func removePlace(listId: String, listPlaceId: String) async throws(APIError)
}

// MARK: - ListsRepository

struct ListsRepository: ListsRepositoryProtocol, Sendable {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func list() async throws(APIError) -> [PlaceList] {
        try await client.request(.lists(), as: [PlaceList].self)
    }

    func get(id: String) async throws(APIError) -> PlaceList {
        try await client.request(.list(id: id), as: PlaceList.self)
    }

    func create(body: CreateListRequest) async throws(APIError) -> PlaceList {
        try await client.request(.createList(body: body), as: PlaceList.self)
    }

    func update(id: String, body: PatchListRequest) async throws(APIError) -> PlaceList {
        try await client.request(.updateList(id: id, body: body), as: PlaceList.self)
    }

    func delete(id: String) async throws(APIError) {
        // DELETE /lists/{id} returns 200 { ok, data: { id, deleted: true } } — not 204.
        _ = try await client.request(.deleteList(id: id), as: DeleteListResult.self)
    }

    func places(
        listId: String,
        limit: Int = 20,
        cursor: String? = nil
    ) async throws(APIError) -> PaginatedResponse<[ListPlaceItem]> {
        // Backend returns { items: [...] } wrapped in the envelope; items is the array.
        let paged = try await client.requestPaginated(
            .listPlaces(listId: listId, limit: limit, cursor: cursor),
            as: ListPlacesData.self
        )
        return PaginatedResponse(data: paged.data.items, pagination: paged.pagination)
    }

    func addPlace(listId: String, placeId: String) async throws(APIError) -> AddListPlaceResult {
        // Returns { list_place_id, list_id, place_id, created_at }
        try await client.request(.addListPlace(listId: listId, placeId: placeId), as: AddListPlaceResult.self)
    }

    func removePlace(listId: String, listPlaceId: String) async throws(APIError) {
        // DELETE returns 200 with { list_place_id, deleted: true }
        _ = try await client.request(.removeListPlace(listId: listId, listPlaceId: listPlaceId), as: RemoveListPlaceResult.self)
    }
}

// MARK: - ListPlacesData

/// Backend wrapper for GET /lists/{id}/places: { items: [...] }
private struct ListPlacesData: Decodable, Sendable {
    let items: [ListPlaceItem]
}
