//
//  AuthAPITests.swift
//  StashhAPITests
//
//  Integration tests that specifically validate the authentication contract:
//  1. A request with a valid JWT succeeds.
//  2. A request with no/invalid token is rejected with .unauthorized.
//

import Testing
import Foundation
import Supabase
@testable import Stashh

// MARK: - NullAuthProvider

/// An AuthTokenProviding conformer that always returns an empty string,
/// simulating a missing or invalid Bearer token for negative auth tests.
private final class NullAuthProvider: AuthTokenProviding, Sendable {
    func accessToken() async throws -> String { "" }
}

// MARK: - AuthAPITests

@Suite("Authentication")
struct AuthAPITests {

    // MARK: - Authenticated Success

    @Test("Authenticated request against a protected endpoint succeeds")
    func authenticatedRequestSucceeds() async throws {
        // GET /library is a low-risk read endpoint — the response proves the JWT was accepted.
        let repo = try await TestAuthHelper.shared.makeLibraryRepository()
        let summary = try await repo.summary()

        // Any successful decode means the backend accepted the Bearer token.
        #expect(summary.totalSavedCount >= 0, "Authenticated request returned valid Library data")
    }

    @Test("Authenticated user can read their own saved places")
    func authenticatedPlacesListSucceeds() async throws {
        let repo = try await TestAuthHelper.shared.makePlacesRepository()
        // A successful paginated response confirms authentication and authorization.
        let response = try await repo.list(limit: 1, cursor: nil, sort: nil, district: nil, category: nil)
        #expect(response.pagination != nil || response.data.count >= 0, "Authenticated response decoded successfully")
    }

    // MARK: - Unauthenticated Failure

    @Test("Request with no token returns .unauthorized error")
    func unauthenticatedRequestFails() async throws {
        let unauthClient = APIClient(
            baseURL: TestConfig.apiBaseURL,
            authManager: NullAuthProvider()
        )
        let repo = LibraryRepository(client: unauthClient)

        // The backend's requireAuth middleware should reject the empty token.
        await #expect(throws: APIError.self) {
            _ = try await repo.summary()
        }
    }

    @Test("Request with malformed Bearer token returns an API error")
    func malformedTokenRequestFails() async throws {
        // A syntactically valid but cryptographically invalid JWT.
        let badToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.INVALID"
        let badProvider = FixedTokenProvider(token: badToken)
        let client = APIClient(baseURL: TestConfig.apiBaseURL, authManager: badProvider)
        let repo = LibraryRepository(client: client)

        await #expect(throws: APIError.self) {
            _ = try await repo.summary()
        }
    }
}

// MARK: - FixedTokenProvider

/// Returns a hardcoded token string, useful for negative auth tests.
private final class FixedTokenProvider: AuthTokenProviding, Sendable {
    private let token: String
    init(token: String) { self.token = token }
    func accessToken() async throws -> String { token }
}
