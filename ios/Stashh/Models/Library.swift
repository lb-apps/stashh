//
//  Library.swift
//  Stashh
//
//  Maps to the `LibrarySummaryData` backend DTO from GET /library.
//  Response shape: { districts, categories, lists, total_saved_count }

import Foundation

// MARK: - Library

struct Library: Codable, Sendable {
    let districts: [LibraryDistrict]
    let categories: [LibraryCategory]
    let lists: [LibraryList]
    let totalSavedCount: Int
}

// MARK: - LibraryDistrict

/// { district, city, place_count }
struct LibraryDistrict: Codable, Sendable, Identifiable, Hashable {
    var id: String { district }
    let district: String
    let city: String?
    let placeCount: Int
}

// MARK: - LibraryCategory

/// { category, place_count }
struct LibraryCategory: Codable, Sendable, Identifiable, Hashable {
    var id: String { category }
    let category: String
    let placeCount: Int
}

// MARK: - LibraryList

/// Lightweight list summary inside the library response.
/// { id, title, emoji, place_count }
struct LibraryList: Codable, Sendable, Identifiable, Hashable {
    let id: String
    let title: String
    let emoji: String?
    let placeCount: Int
}
