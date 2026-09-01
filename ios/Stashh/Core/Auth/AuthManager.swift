//
//  AuthManager.swift
//  Stashh
//

import Auth
import Foundation
import Supabase

// MARK: - AuthTokenProviding

/// Minimal protocol for providing a Bearer JWT access token.
/// Conforming to this protocol allows both the production AuthManager and
/// test helpers to be passed to APIClient without coupling to Supabase.
protocol AuthTokenProviding: Sendable {
    /// Returns the current JWT access token, refreshing automatically if needed.
    func accessToken() async throws -> String
}

// MARK: - AuthManager

/// Wraps Supabase Auth and exposes only what the app needs.
///
/// Responsibilities:
/// - Sign in with Apple (OAuth via Supabase)
/// - Sign out
/// - Provide the current JWT access token to APIClient
/// - Observe and publish auth state changes
@Observable
@MainActor
final class AuthManager {

    // MARK: State

    private(set) var isAuthenticated: Bool = false
    private(set) var currentUserId: String?

    // MARK: Dependencies

    private let supabase: SupabaseClient

    // MARK: Init

    init(supabaseURL: URL, supabaseAnonKey: String) {
        self.supabase = SupabaseClient(
            supabaseURL: supabaseURL,
            supabaseKey: supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    storage: KeychainLocalStorage(),
                    emitLocalSessionAsInitialSession: true
                )
            )
        )
    }

    // MARK: - Lifecycle

    /// Starts observing Supabase auth state changes.
    /// Call once from AppState initializer.
    func startObservingAuthState() {
        Task { [weak self] in
            guard let self else { return }
            for await (event, session) in supabase.auth.authStateChanges {
                await MainActor.run {
                    switch event {
                    case .initialSession, .signedIn, .tokenRefreshed, .userUpdated:
                        self.isAuthenticated = session != nil && session?.isExpired == false
                        self.currentUserId = session?.user.id.uuidString
                    case .signedOut, .passwordRecovery, .userDeleted:
                        self.isAuthenticated = false
                        self.currentUserId = nil
                    default:
                        break
                    }
                }
            }
        }
    }

    // MARK: - Sign In

    /// Initiates Sign in with Apple flow via Supabase OAuth.
    nonisolated func signInWithApple() async throws {
        try await supabase.auth.signInWithOAuth(provider: .apple)
    }

    /// Signs in with email and password. Used only in DEBUG builds.
    nonisolated func signIn(email: String, password: String) async throws {
        try await supabase.auth.signIn(email: email, password: password)
    }

    /// In DEBUG builds: signs in with DEV_TEST credentials if not already authenticated.
    /// No-ops in Release/Staging builds (method isn't called from AppState in those configs).
    nonisolated func debugAutoSignInIfNeeded() async {
        guard
            let email = AppConfig.debugEmail,
            let password = AppConfig.debugPassword
        else { return }

        // Already have a valid session — no need to re-login
        if let session = try? await supabase.auth.session, !session.isExpired {
            return
        }

        do {
            try await supabase.auth.signIn(email: email, password: password)
        } catch {
            print("[DEBUG] Auto sign-in failed: \(error)")
        }
    }

    // MARK: - Sign Out

    nonisolated func signOut() async throws {
        try await supabase.auth.signOut()
    }

    // MARK: - Token Access

    /// Returns the current access token (JWT) for use as a Bearer token.
    /// Automatically refreshes if expired.
    nonisolated func accessToken() async throws -> String {
        let session = try await supabase.auth.session
        return session.accessToken
    }

    // MARK: - Restore Session

    /// Attempts to restore a previously persisted session on app launch.
    nonisolated func restoreSession() async {
        _ = try? await supabase.auth.session
    }
}

// MARK: - AuthTokenProviding Conformance

extension AuthManager: AuthTokenProviding {}
