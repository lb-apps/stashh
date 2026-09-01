//
//  RequestBodies.swift
//  Stashh
//
//  All Encodable request body structs used by APIEndpoint.
//  Each matches the backend's expected JSON shape (snake_case via encoder strategy).

import Foundation

// MARK: - Places

/// POST /places — add places from Google Places or a recognition result
enum AddPlacesRequest: Encodable, Sendable {
    case google(placeIds: [String])
    case recognition(recognitionResultId: String, placeIds: [String])

    private enum CodingKeys: String, CodingKey {
        case source, placeIds, recognitionResultId
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .google(let placeIds):
            try container.encode("google", forKey: .source)
            try container.encode(placeIds, forKey: .placeIds)
        case .recognition(let recognitionResultId, let placeIds):
            try container.encode("recognition", forKey: .source)
            try container.encode(recognitionResultId, forKey: .recognitionResultId)
            try container.encode(placeIds, forKey: .placeIds)
        }
    }
}

/// PATCH /places/:id — update notes on a saved place
struct UpdatePlaceRequest: Encodable, Sendable {
    let notes: String?
}

// MARK: - Lists

/// POST /lists — create a new list
struct CreateListRequest: Encodable, Sendable {
    let title: String
    var description: String?
    var emoji: String?
    var placeIds: [String]?
}

/// PATCH /lists/:id — update list metadata
struct PatchListRequest: Encodable, Sendable {
    var title: String?
    var description: String?
    var emoji: String?
}

/// POST /lists/:id/places — add a place to a list
struct AddListPlaceRequest: Encodable, Sendable {
    let placeId: String
}

// MARK: - Recognitions

/// POST /recognitions — enqueue a new recognition task
struct CreateRecognitionRequest: Encodable, Sendable {
    let sourceUrl: String
}
