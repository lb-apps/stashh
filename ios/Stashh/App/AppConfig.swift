//
//  AppConfig.swift
//  Stashh
//
//  Runtime configuration loaded from AppConfig.plist, which is copied into the
//  bundle by the "Copy Config Plist" build phase from Config/<Configuration>.plist.
//  To change values per environment, edit the corresponding ios/Config/*.plist file.
//  Never hardcode secrets here.
//

import Foundation

// MARK: - AppConfig

enum AppConfig {

    // MARK: - Private

    // `[String: Any]` is not Sendable; plist is loaded once and only read thereafter.
    nonisolated(unsafe) private static let plist: [String: Any] = {
        guard
            let url = Bundle.main.url(forResource: "AppConfig", withExtension: "plist"),
            let dict = NSDictionary(contentsOf: url) as? [String: Any]
        else {
            fatalError(
                "AppConfig.plist not found in bundle. " +
                "Make sure Config/<Configuration>.plist exists and the " +
                "'Copy Config Plist' build phase ran successfully."
            )
        }
        return dict
    }()

    private static func string(_ key: String, required: Bool = true) -> String {
        guard let value = plist[key] as? String, !value.isEmpty else {
            if required {
                fatalError("AppConfig: missing or empty value for key '\(key)' in AppConfig.plist.")
            }
            return ""
        }
        return value
    }

    // MARK: - API

    /// Base URL for the Stashh Express backend.
    static let apiBaseURL: URL = {
        let raw = string("APIBaseURL")
        guard let url = URL(string: raw) else {
            fatalError("AppConfig: invalid URL for key 'APIBaseURL': \(raw)")
        }
        return url
    }()

    // MARK: - Supabase

    /// Supabase project URL.
    static let supabaseURL: URL = {
        let raw = string("SupabaseURL")
        guard let url = URL(string: raw) else {
            fatalError("AppConfig: invalid URL for key 'SupabaseURL': \(raw)")
        }
        return url
    }()

    /// Supabase anonymous/public key.
    static let supabaseAnonKey: String = string("SupabaseAnonKey")

    // MARK: - Debug Credentials

    /// Email for debug auto-login. Non-nil only when set in the config plist.
    static var debugEmail: String? {
        let value = plist["DevTestEmail"] as? String
        return value?.isEmpty == false ? value : nil
    }

    /// Password for debug auto-login. Non-nil only when set in the config plist.
    static var debugPassword: String? {
        let value = plist["DevTestPassword"] as? String
        return value?.isEmpty == false ? value : nil
    }

    // MARK: - Convenience

    static var isDebug: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    static var isStaging: Bool {
        #if STAGING
        return true
        #else
        return false
        #endif
    }
}
