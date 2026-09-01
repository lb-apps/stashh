//
//  PlaceList.swift
//  Stashh
//

import Foundation

// MARK: - PlaceList

/// A user-created list summary.
/// Maps to the `ListSummary` backend DTO.
struct PlaceList: Codable, Identifiable, Sendable, Hashable {
    let id: String
    let title: String
    let description: String?
    let emoji: String?
    let placeCount: Int
    let createdAt: String
    let updatedAt: String
}
