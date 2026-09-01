//
//  AppState.swift
//  Stashh
//

import Foundation

// MARK: - AppState

/// Root @Observable that holds all shared dependencies and is injected into the SwiftUI environment.
///
/// Usage in views:
/// ```swift
/// @Environment(AppState.self) private var appState
/// ```
@Observable
@MainActor
final class AppState {

    // MARK: Core Dependencies

    let authManager: AuthManager
    let apiClient: APIClient

    // MARK: Repositories

    let placesRepository: PlacesRepository
    let listsRepository: ListsRepository
    let libraryRepository: LibraryRepository
    let recognitionsRepository: RecognitionsRepository

    // MARK: Init

    init() {
        let auth = AuthManager(
            supabaseURL: AppConfig.supabaseURL,
            supabaseAnonKey: AppConfig.supabaseAnonKey
        )
        let client = APIClient(baseURL: AppConfig.apiBaseURL, authManager: auth)

        self.authManager = auth
        self.apiClient = client
        self.placesRepository = PlacesRepository(client: client)
        self.listsRepository = ListsRepository(client: client)
        self.libraryRepository = LibraryRepository(client: client)
        self.recognitionsRepository = RecognitionsRepository(client: client)

        // Start listening to Supabase auth state immediately
        auth.startObservingAuthState()

        // Restore an existing session, then auto-login in DEBUG if not already authenticated
        Task { [weak auth] in
            await auth?.restoreSession()

            #if DEBUG
            await auth?.debugAutoSignInIfNeeded()
            #endif
        }
    }
}
