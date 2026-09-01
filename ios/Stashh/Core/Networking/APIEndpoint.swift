//
//  APIEndpoint.swift
//  Stashh
//

import Foundation

// MARK: - HTTPMethod

enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

// MARK: - APIEndpoint

/// Type-safe builder for all backend API endpoints.
/// All routes live under /api/v1/ as defined in the Express backend.
struct APIEndpoint: Sendable {
    let path: String
    let method: HTTPMethod
    let queryItems: [URLQueryItem]
    let body: (any Encodable & Sendable)?

    init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        body: (any Encodable & Sendable)? = nil
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.body = body
    }
}

// MARK: - Places Endpoints

extension APIEndpoint {
    /// GET /places — list saved places with optional filtering
    static func places(
        limit: Int = 20,
        cursor: String? = nil,
        sort: String? = nil,
        district: String? = nil,
        category: String? = nil
    ) -> Self {
        var items: [URLQueryItem] = [URLQueryItem(name: "limit", value: "\(limit)")]
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        if let sort { items.append(URLQueryItem(name: "sort", value: sort)) }
        if let district { items.append(URLQueryItem(name: "district", value: district)) }
        if let category { items.append(URLQueryItem(name: "category", value: category)) }
        return Self(path: "/places", method: .get, queryItems: items)
    }

    /// GET /places/:id — get a single saved place
    static func place(id: String) -> Self {
        Self(path: "/places/\(id)", method: .get)
    }

    /// POST /places — add one or more places
    static func addPlaces(body: AddPlacesRequest) -> Self {
        Self(path: "/places", method: .post, body: body)
    }

    /// PATCH /places/:id — update a saved place (notes)
    static func updatePlace(id: String, body: UpdatePlaceRequest) -> Self {
        Self(path: "/places/\(id)", method: .patch, body: body)
    }

    /// DELETE /places/:id — remove a saved place
    static func deletePlace(id: String) -> Self {
        Self(path: "/places/\(id)", method: .delete)
    }

    /// GET /places/photos/:placeId — get Google photo URLs for a place
    static func placePhotos(id: String, limit: Int = 10, maxWidth: Int = 800) -> Self {
        let items: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "max_width_px", value: "\(maxWidth)"),
        ]
        return Self(path: "/places/photos/\(id)", method: .get, queryItems: items)
    }

    /// GET /places/nearby — list saved places within a radius, ordered by distance
    static func nearbyPlaces(
        latitude: Double,
        longitude: Double,
        radiusM: Int = 1000,
        limit: Int = 20,
        cursor: String? = nil,
        category: String? = nil
    ) -> Self {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "latitude", value: "\(latitude)"),
            URLQueryItem(name: "longitude", value: "\(longitude)"),
            URLQueryItem(name: "radius_m", value: "\(radiusM)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
        ]
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        if let category { items.append(URLQueryItem(name: "category", value: category)) }
        return Self(path: "/places/nearby", method: .get, queryItems: items)
    }
}

// MARK: - Lists Endpoints

extension APIEndpoint {
    /// GET /lists — list all user lists
    static func lists() -> Self {
        Self(path: "/lists", method: .get)
    }

    /// GET /lists/:id — get a single list
    static func list(id: String) -> Self {
        Self(path: "/lists/\(id)", method: .get)
    }

    /// POST /lists — create a new list
    static func createList(body: CreateListRequest) -> Self {
        Self(path: "/lists", method: .post, body: body)
    }

    /// PATCH /lists/:id — update a list
    static func updateList(id: String, body: PatchListRequest) -> Self {
        Self(path: "/lists/\(id)", method: .patch, body: body)
    }

    /// DELETE /lists/:id — delete a list
    static func deleteList(id: String) -> Self {
        Self(path: "/lists/\(id)", method: .delete)
    }

    /// GET /lists/:id/places — paginated places in a list
    static func listPlaces(listId: String, limit: Int = 20, cursor: String? = nil) -> Self {
        var items: [URLQueryItem] = [URLQueryItem(name: "limit", value: "\(limit)")]
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        return Self(path: "/lists/\(listId)/places", method: .get, queryItems: items)
    }

    /// POST /lists/:id/places — add a place to a list
    static func addListPlace(listId: String, placeId: String) -> Self {
        Self(path: "/lists/\(listId)/places", method: .post, body: AddListPlaceRequest(placeId: placeId))
    }

    /// DELETE /lists/:listId/places/:listPlaceId — remove a place from a list
    static func removeListPlace(listId: String, listPlaceId: String) -> Self {
        Self(path: "/lists/\(listId)/places/\(listPlaceId)", method: .delete)
    }
}

// MARK: - Library Endpoint

extension APIEndpoint {
    /// GET /library — aggregated library summary
    static func library() -> Self {
        Self(path: "/library", method: .get)
    }
}

// MARK: - Recognitions Endpoints

extension APIEndpoint {
    /// POST /recognitions — enqueue a new recognition task
    static func createRecognition(sourceURL: String) -> Self {
        Self(path: "/recognitions", method: .post, body: CreateRecognitionRequest(sourceUrl: sourceURL))
    }

    /// GET /recognitions/:id — get recognition task status
    static func recognitionStatus(id: String) -> Self {
        Self(path: "/recognitions/\(id)", method: .get)
    }

    /// GET /recognitions/result?id={resultId} — get recognition result by result_id
    static func recognitionResult(resultId: String) -> Self {
        Self(path: "/recognitions/result", method: .get, queryItems: [URLQueryItem(name: "id", value: resultId)])
    }

    /// POST /recognitions/{id}/commit — commit recognition to library
    static func commitRecognition(id: String) -> Self {
        Self(path: "/recognitions/\(id)/commit", method: .post)
    }
}
