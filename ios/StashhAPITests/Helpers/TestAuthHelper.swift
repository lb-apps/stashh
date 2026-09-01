//
//  TestAuthHelper.swift
//  StashhAPITests
//
//  A shared actor that authenticates once against Supabase using email/password
//  test credentials, then vends fully-authenticated repository instances to every
//  test suite. The session is cached so Supabase is only hit once per test run.
//

import Foundation
import Supabase
@testable import Stashh

// MARK: - TestAuthProvider

/// A lightweight AuthTokenProviding conformer that returns a pre-fetched JWT.
/// The token is obtained once during sign-in and stored here; no further Supabase
/// auth calls are made during requests, which avoids actor/session race conditions.
final class TestAuthProvider: AuthTokenProviding, Sendable {

    private let token: String

    init(token: String) {
        self.token = token
    }

    func accessToken() async throws -> String {
        return token
    }
}

// MARK: - TestAuthHelper

/// Global actor-isolated helper that signs in exactly once and provides
/// ready-to-use repository instances for the test suites.
///
/// Usage:
/// ```swift
/// let repo = try await TestAuthHelper.shared.makePlacesRepository()
/// ```
actor TestAuthHelper {

    // MARK: Shared Instance

    static let shared = TestAuthHelper()

    // MARK: Private State

    private let supabase: SupabaseClient
    private var apiClient: APIClient?

    // MARK: Init

    private init() {
        supabase = SupabaseClient(
            supabaseURL: TestConfig.supabaseURL,
            supabaseKey: TestConfig.supabaseAnonKey
        )
    }

    // MARK: - Authentication

    /// Signs in with test credentials if not already authenticated,
    /// then returns a cached `APIClient` ready for use.
    func authenticatedClient() async throws -> APIClient {
        if let existing = apiClient {
            return existing
        }

        // Sign in with email + password and capture the access token directly.
        // Using the session's accessToken directly avoids relying on supabase.auth.session
        // after the fact, which can fail in actor/async test contexts.
        let session = try await supabase.auth.signIn(
            email: TestConfig.testEmail,
            password: TestConfig.testPassword
        )

        let provider = TestAuthProvider(token: session.accessToken)
        let client = APIClient(
            baseURL: TestConfig.apiBaseURL,
            authManager: provider
        )

        apiClient = client
        return client
    }

    // MARK: - Repository Factories

    /// Returns an authenticated `PlacesRepository`.
    func makePlacesRepository() async throws -> PlacesRepository {
        PlacesRepository(client: try await authenticatedClient())
    }

    /// Returns an authenticated `ListsRepository`.
    func makeListsRepository() async throws -> ListsRepository {
        ListsRepository(client: try await authenticatedClient())
    }

    /// Returns an authenticated `LibraryRepository`.
    func makeLibraryRepository() async throws -> LibraryRepository {
        LibraryRepository(client: try await authenticatedClient())
    }

    /// Returns an authenticated `RecognitionsRepository`.
    func makeRecognitionsRepository() async throws -> RecognitionsRepository {
        RecognitionsRepository(client: try await authenticatedClient())
    }

    /// Returns the raw authenticated `APIClient` for low-level tests (e.g. auth error tests).
    func rawClient() async throws -> APIClient {
        try await authenticatedClient()
    }
}
