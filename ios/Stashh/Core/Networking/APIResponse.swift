//
//  APIResponse.swift
//  Stashh
//

import Foundation

// MARK: - APIResponse

/// Generic envelope wrapping all backend responses.
/// Backend always returns: { ok, data?, meta, error? }
struct APIResponse<T: Decodable>: Decodable {
    let ok: Bool
    let data: T?
    let meta: APIResponseMeta
    let error: APIResponseError?
}

// MARK: - APIResponseMeta

struct APIResponseMeta: Decodable {
    let requestId: String
    let pagination: PaginationMeta?
}

// MARK: - PaginationMeta

struct PaginationMeta: Decodable {
    let limit: Int
    let nextCursor: String?
    let hasMore: Bool
}

// MARK: - APIResponseError

struct APIResponseError: Decodable {
    let code: String
    let message: String
    let details: AnyCodable?
}

// MARK: - PaginatedResponse

/// Wraps a decoded payload together with pagination info for cursor-based pagination.
struct PaginatedResponse<T: Sendable>: Sendable {
    let data: T
    let pagination: PaginationMeta?
}

// MARK: - AnyCodable

/// Type-erased Codable container for arbitrary JSON details fields.
struct AnyCodable: Codable, @unchecked Sendable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intValue = try? container.decode(Int.self) {
            value = intValue
        } else if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        } else if let stringValue = try? container.decode(String.self) {
            value = stringValue
        } else if let arrayValue = try? container.decode([AnyCodable].self) {
            value = arrayValue.map(\.value)
        } else if let dictValue = try? container.decode([String: AnyCodable].self) {
            value = dictValue.mapValues(\.value)
        } else {
            value = NSNull()
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let intValue as Int:
            try container.encode(intValue)
        case let doubleValue as Double:
            try container.encode(doubleValue)
        case let boolValue as Bool:
            try container.encode(boolValue)
        case let stringValue as String:
            try container.encode(stringValue)
        case is NSNull:
            try container.encodeNil()
        default:
            try container.encodeNil()
        }
    }
}
