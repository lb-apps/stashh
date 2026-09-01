//
//  APIClient.swift
//  Stashh
//

import Foundation

// MARK: - APIClient

/// Generic async/await HTTP client for the Stashh backend.
///
/// Responsibilities:
/// - Builds URLRequests from APIEndpoint definitions
/// - Injects Bearer JWT from AuthManager on every request
/// - Decodes the standard { ok, data, meta, error } envelope
/// - Maps all failures to typed APIError
/// - Configures JSONDecoder with snake_case key strategy once
final class APIClient: Sendable {

    // MARK: Dependencies

    private let baseURL: URL
    private let session: URLSession
    let authManager: any AuthTokenProviding

    // MARK: Init

    init(baseURL: URL, authManager: any AuthTokenProviding, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.authManager = authManager
    }

    // MARK: Decoder

    private static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    // MARK: - Request (non-paginated)

    /// Performs a request and decodes the `data` field of the response envelope.
    func request<T: Decodable>(
        _ endpoint: APIEndpoint,
        as type: T.Type = T.self
    ) async throws(APIError) -> T {
        let urlRequest = try await buildRequest(for: endpoint)
        let responseData = try await perform(urlRequest)
        return try decode(APIResponse<T>.self, from: responseData, endpoint: endpoint).unwrapped()
    }

    // MARK: - Request (paginated)

    /// Performs a request and returns both data and pagination metadata.
    func requestPaginated<T: Decodable>(
        _ endpoint: APIEndpoint,
        as type: T.Type = T.self
    ) async throws(APIError) -> PaginatedResponse<T> {
        let urlRequest = try await buildRequest(for: endpoint)
        let responseData = try await perform(urlRequest)
        let envelope = try decode(APIResponse<T>.self, from: responseData, endpoint: endpoint)
        let data = try envelope.unwrapped()
        return PaginatedResponse(data: data, pagination: envelope.meta.pagination)
    }

    // MARK: - Request (no body response)

    /// Performs a request that returns no meaningful data (e.g., DELETE).
    func requestVoid(_ endpoint: APIEndpoint) async throws(APIError) {
        let urlRequest = try await buildRequest(for: endpoint)
        let responseData = try await perform(urlRequest)
        // Decode to verify ok: true; use a dummy Decodable for the data field
        _ = try decode(APIResponse<EmptyDecodable>.self, from: responseData, endpoint: endpoint)
    }

    // MARK: - Private Helpers

    private func buildRequest(for endpoint: APIEndpoint) async throws(APIError) -> URLRequest {
        var components = URLComponents(url: baseURL.appendingPathComponent(endpoint.path), resolvingAgainstBaseURL: false)
        if !endpoint.queryItems.isEmpty {
            components?.queryItems = endpoint.queryItems
        }
        guard let url = components?.url else {
            throw APIError.networkError(underlying: URLError(.badURL))
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Inject JWT Bearer token
        do {
            let token = try await authManager.accessToken()
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } catch {
            throw APIError.unauthorized
        }

        // Encode body if present
        if let body = endpoint.body {
            do {
                let encoder = JSONEncoder()
                encoder.keyEncodingStrategy = .convertToSnakeCase
                request.httpBody = try encoder.encode(AnyEncodable(body))
            } catch {
                throw APIError.networkError(underlying: error)
            }
        }

        return request
    }

    private func perform(_ request: URLRequest) async throws(APIError) -> Data {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw APIError.networkError(underlying: URLError(.badServerResponse))
            }
            // We always try to decode the envelope; HTTP status is a hint only
            _ = http.statusCode
            return data
        } catch let apiError as APIError {
            throw apiError
        } catch {
            throw APIError.networkError(underlying: error)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data, endpoint: APIEndpoint) throws(APIError) -> T {
        do {
            return try Self.decoder.decode(type, from: data)
        } catch {
            throw APIError.decodingError(underlying: error)
        }
    }
}

// MARK: - APIResponse Unwrap Helper

private extension APIResponse {
    func unwrapped() throws(APIError) -> T {
        if ok, let data {
            return data
        }
        if let error {
            throw APIError.from(
                code: error.code,
                message: error.message,
                statusCode: 0,
                details: error.details?.value as? [String: String]
            )
        }
        throw APIError.serverError(statusCode: 0, message: "Unknown server error", code: "UNKNOWN")
    }
}

// MARK: - Type Erasure Helpers

private struct EmptyDecodable: Decodable {}

/// Type-erased Encodable wrapper for encoding `any Encodable` values.
private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        _encode = value.encode
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
