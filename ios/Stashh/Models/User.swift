//
//  User.swift
//  Stashh
//

import Foundation

// MARK: - User

/// The app user, typically populated from Supabase auth session metadata.
struct User: Codable, Identifiable, Sendable, Hashable {
    let id: String
    let email: String?
    let fullName: String?
    let avatarUrl: String?
    let createdAt: String?
}
