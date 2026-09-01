//
//  TestConfig.swift
//  StashhAPITests
//
//  Reads test-specific configuration from the test bundle's Info.plist.
//  All values are injected at build time from Testing.xcconfig via build
//  settings, so no secrets are hardcoded in Swift source.
//

import Foundation

/// Static accessors for all configuration values required by the API integration tests.
enum TestConfig {

    // MARK: - Bundle

    private static var bundle: Bundle { Bundle(for: TestAuthHelper.self) }

    private static func required(_ key: String) -> String {
        guard let value = bundle.object(forInfoDictionaryKey: key) as? String,
              !value.isEmpty,
              !value.hasPrefix("$(") // guard against unexpanded xcconfig variable
        else {
            fatalError(
                """
                TestConfig: missing or unexpanded Info.plist key '\(key)'.
                Make sure Testing.xcconfig is configured and the StashhAPITests
                target's Info.plist is mapped to the correct xcconfig variables.
                """
            )
        }
        return value
    }

    // MARK: - API

    /// Base URL of the local dev backend (e.g. http://localhost:3000/api/v1)
    static let apiBaseURL: URL = {
        let raw = required("APIBaseURL")
        guard let url = URL(string: raw) else {
            fatalError("TestConfig: 'APIBaseURL' is not a valid URL: \(raw)")
        }
        return url
    }()

    // MARK: - Supabase

    /// URL of the Supabase project.
    static let supabaseURL: URL = {
        let raw = required("SupabaseURL")
        guard let url = URL(string: raw) else {
            fatalError("TestConfig: 'SupabaseURL' is not a valid URL: \(raw)")
        }
        return url
    }()

    /// Supabase anon/publishable key for the client.
    static let supabaseAnonKey: String = required("SupabaseAnonKey")

    // MARK: - Test Credentials

    /// Email for the Supabase test user (injected from TEST_EMAIL xcconfig variable).
    static let testEmail: String = required("TestEmail")

    /// Password for the Supabase test user (injected from TEST_PASSWORD xcconfig variable).
    static let testPassword: String = required("TestPassword")
}
