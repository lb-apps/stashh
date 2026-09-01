//
//  APIError.swift
//  Stashh
//

import Foundation

// MARK: - APIError

/// Typed Swift representation of all backend error codes.
/// Maps the Express backend error codes to specific Swift cases.
enum APIError: Error, Sendable {
    // Auth
    case unauthorized
    case forbidden

    // Resource errors
    case placeNotFound
    case listNotFound
    case listPlaceNotFound
    case recognitionNotFound
    case recognitionResultNotFound

    // Conflict errors
    case placeAlreadySaved
    case placeAlreadyInList
    case listLimitReached
    case recognitionAlreadyCommitted
    case recognitionNotReady

    // Validation
    case validationError(message: String, details: [String: String]?)

    // Rate limiting
    case rateLimited

    // Generic server error
    case serverError(statusCode: Int, message: String, code: String)

    // Network/transport
    case networkError(underlying: any Error)
    case decodingError(underlying: any Error)
}

// MARK: - LocalizedError

extension APIError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Authentication required. Please sign in."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .placeNotFound:
            return "Place not found."
        case .listNotFound:
            return "List not found."
        case .listPlaceNotFound:
            return "Place not found in list."
        case .recognitionNotFound:
            return "Recognition task not found."
        case .recognitionResultNotFound:
            return "Recognition result not found."
        case .placeAlreadySaved:
            return "This place is already in your library."
        case .placeAlreadyInList:
            return "This place is already in the list."
        case .listLimitReached:
            return "You've reached the maximum number of lists."
        case .recognitionAlreadyCommitted:
            return "This recognition has already been committed."
        case .recognitionNotReady:
            return "Recognition result is not ready yet."
        case .validationError(let message, _):
            return message
        case .rateLimited:
            return "Too many requests. Please try again later."
        case .serverError(_, let message, _):
            return message
        case .networkError(let underlying):
            return underlying.localizedDescription
        case .decodingError:
            return "Failed to parse server response."
        }
    }
}

// MARK: - Factory

extension APIError {
    /// Maps a backend error code string + HTTP status to a typed APIError.
    static func from(code: String, message: String, statusCode: Int, details: [String: String]?) -> APIError {
        switch code {
        case "UNAUTHORIZED":
            return .unauthorized
        case "FORBIDDEN":
            return .forbidden
        case "PLACE_NOT_FOUND":
            return .placeNotFound
        case "LIST_NOT_FOUND":
            return .listNotFound
        case "LIST_PLACE_NOT_FOUND":
            return .listPlaceNotFound
        case "RECOGNITION_NOT_FOUND":
            return .recognitionNotFound
        case "RECOGNITION_RESULT_NOT_FOUND":
            return .recognitionResultNotFound
        case "PLACE_ALREADY_SAVED":
            return .placeAlreadySaved
        case "PLACE_ALREADY_IN_LIST":
            return .placeAlreadyInList
        case "LIST_LIMIT_REACHED":
            return .listLimitReached
        case "RECOGNITION_ALREADY_COMMITTED":
            return .recognitionAlreadyCommitted
        case "RECOGNITION_NOT_READY":
            return .recognitionNotReady
        case "VALIDATION_ERROR":
            return .validationError(message: message, details: details)
        case "RATE_LIMIT_EXCEEDED":
            return .rateLimited
        default:
            return .serverError(statusCode: statusCode, message: message, code: code)
        }
    }
}
